/*
* Copyright (C) 2026 AuroraYgg Project
*
* Share Link API — create and manage direct download links
* with granular access control (public, password, invite, user-whitelist).
*/

#include "stdinc.h"

#include <api/ShareLinkApi.h>
#include <web-server/JsonUtil.h>
#include <web-server/Session.h>
#include <web-server/WebUser.h>
#include <web-server/WebServerManager.h>
#include <web-server/WebServerSettings.h>

#include <airdcpp/util/Util.h>
#include <airdcpp/util/PathUtil.h>
#include <airdcpp/core/timer/TimerManager.h>

#include <fstream>
#include <random>

#define LINK_CONFIG_NAME "share-links.json"

namespace webserver {

	// In-memory link storage (persisted to share-links.json)
	static SharedMutex linksMutex;
	static std::map<string, ShareLink> linksMap;
	static bool linksDirty = false;

	static string generateLinkId() {
		// Simple UUID-like ID using random
		static std::mt19937 rng(std::random_device{}());
		static std::uniform_int_distribution<uint32_t> dist;
		char buf[32];
		snprintf(buf, sizeof(buf), "%08x%08x%08x", dist(rng), dist(rng), dist(rng));
		return string(buf, 24);
	}

	static string accessToString(ShareLinkAccess a) {
		switch (a) {
			case ShareLinkAccess::PUBLIC: return "public";
			case ShareLinkAccess::PASSWORD: return "password";
			case ShareLinkAccess::INVITE_ONLY: return "invite";
			case ShareLinkAccess::USERS_ONLY: return "users";
			default: return "public";
		}
	}

	static ShareLinkAccess stringToAccess(const string& s) {
		if (s == "password") return ShareLinkAccess::PASSWORD;
		if (s == "invite") return ShareLinkAccess::INVITE_ONLY;
		if (s == "users") return ShareLinkAccess::USERS_ONLY;
		return ShareLinkAccess::PUBLIC;
	}

	static json serializeLink(const ShareLink& link) {
		return {
			{ "id", link.id },
			{ "path", link.path },
			{ "virtual_name", link.virtualName },
			{ "created_by", link.createdBy },
			{ "created_at", link.createdAt },
			{ "expires_at", link.expiresAt },
			{ "access", accessToString(link.access) },
			{ "has_password", !link.password.empty() },
			{ "allowed_users", link.allowedUsers },
			{ "download_count", link.downloadCount },
			{ "max_downloads", link.maxDownloads },
			{ "active", link.active },
		};
	}

	static void loadLinks() {
		auto configPath = AppUtil::getPath(AppUtil::PATH_USER_CONFIG) + LINK_CONFIG_NAME;
		try {
			std::ifstream f(configPath);
			if (!f.is_open()) return;

			json j;
			f >> j;

			WLock l(linksMutex);
			linksMap.clear();

			for (const auto& item : j.value("links", json::array())) {
				ShareLink link;
				link.id = item.at("id");
				link.path = item.at("path");
				link.virtualName = item.value("virtual_name", "");
				link.createdBy = item.value("created_by", "");
				link.createdAt = item.value("created_at", (time_t)0);
				link.expiresAt = item.value("expires_at", (time_t)0);
				link.access = stringToAccess(item.value("access", "public"));
				link.password = item.value("password", "");
				link.allowedUsers = item.value("allowed_users", StringList{});
				link.downloadCount = item.value("download_count", (int64_t)0);
				link.maxDownloads = item.value("max_downloads", (int64_t)0);
				link.active = item.value("active", true);

				linksMap[link.id] = std::move(link);
			}
		} catch (...) {
			// Ignore parse errors
		}
	}

	static void saveLinks() {
		if (!linksDirty) return;
		linksDirty = false;

		json j;
		{
			RLock l(linksMutex);
			for (const auto& [_, link] : linksMap) {
				j["links"].push_back({
					{ "id", link.id },
					{ "path", link.path },
					{ "virtual_name", link.virtualName },
					{ "created_by", link.createdBy },
					{ "created_at", link.createdAt },
					{ "expires_at", link.expiresAt },
					{ "access", accessToString(link.access) },
					{ "password", link.password },
					{ "allowed_users", link.allowedUsers },
					{ "download_count", link.downloadCount },
					{ "max_downloads", link.maxDownloads },
					{ "active", link.active },
				});
			}
		}

		auto configPath = AppUtil::getPath(AppUtil::PATH_USER_CONFIG) + LINK_CONFIG_NAME;
		try {
			std::ofstream f(configPath);
			f << j.dump(2);
		} catch (...) {}
	}

	ShareLinkApi::ShareLinkApi(Session* aSession) :
		ApiModule(aSession)
	{
		// Load persisted links
		loadLinks();

		METHOD_HANDLER(Access::SHARE_VIEW, METHOD_GET,     (),                         ShareLinkApi::handleGetLinks);
		METHOD_HANDLER(Access::SHARE_EDIT, METHOD_POST,    (),                         ShareLinkApi::handleCreateLink);
		METHOD_HANDLER(Access::SHARE_VIEW, METHOD_GET,     (STR_PARAM("link_id")),     ShareLinkApi::handleGetLink);
		METHOD_HANDLER(Access::SHARE_EDIT, METHOD_PATCH,   (STR_PARAM("link_id")),     ShareLinkApi::handleUpdateLink);
		METHOD_HANDLER(Access::SHARE_EDIT, METHOD_DELETE,  (STR_PARAM("link_id")),     ShareLinkApi::handleDeleteLink);
	}

	ShareLinkApi::~ShareLinkApi() {
		saveLinks();
	}

	api_return ShareLinkApi::handleGetLinks(ApiRequest& aRequest) {
		json j = json::array();
		RLock l(linksMutex);
		for (const auto& [_, link] : linksMap) {
			j.push_back(serializeLink(link));
		}
		aRequest.setResponseBody(j);
		return http_status::ok;
	}

	api_return ShareLinkApi::handleCreateLink(ApiRequest& aRequest) {
		const auto& reqJson = aRequest.getRequestBody();

		ShareLink link;
		link.id = generateLinkId();
		link.path = JsonUtil::getField<string>("path", reqJson, false);
		link.virtualName = JsonUtil::getOptionalFieldDefault<string>("virtual_name", reqJson, "");
		link.createdBy = getSession()->getUser()->getUserName();
		link.createdAt = GET_TIME();

		auto expiresHours = JsonUtil::getOptionalFieldDefault<int>("expires_hours", reqJson, 0);
		link.expiresAt = expiresHours > 0 ? GET_TIME() + (expiresHours * 3600) : 0;

		link.access = stringToAccess(JsonUtil::getOptionalFieldDefault<string>("access", reqJson, "public"));
		link.password = JsonUtil::getOptionalFieldDefault<string>("password", reqJson, "");
		link.allowedUsers = JsonUtil::getOptionalFieldDefault<StringList>("allowed_users", reqJson, StringList{});
		link.maxDownloads = JsonUtil::getOptionalFieldDefault<int64_t>("max_downloads", reqJson, 0);
		link.downloadCount = 0;
		link.active = true;

		// Validate path exists
		if (!PathUtil::fileExists(link.path) && !PathUtil::fileExists(link.path)) {
			throw RequestException(http_status::bad_request, "Path does not exist: " + link.path);
		}

		{
			WLock l(linksMutex);
			linksMap[link.id] = link;
			linksDirty = true;
		}

		saveLinks();

		json response = serializeLink(link);
		// Include the full share URL
		response["url"] = "aurora://" + link.id;
		aRequest.setResponseBody(response);
		return http_status::ok;
	}

	api_return ShareLinkApi::handleGetLink(ApiRequest& aRequest) {
		const auto& linkId = aRequest.getStringParam("link_id");
		RLock l(linksMutex);
		auto it = linksMap.find(linkId);
		if (it == linksMap.end()) {
			throw RequestException(http_status::not_found, "Link not found");
		}
		aRequest.setResponseBody(serializeLink(it->second));
		return http_status::ok;
	}

	api_return ShareLinkApi::handleUpdateLink(ApiRequest& aRequest) {
		const auto& linkId = aRequest.getStringParam("link_id");
		const auto& reqJson = aRequest.getRequestBody();

		WLock l(linksMutex);
		auto it = linksMap.find(linkId);
		if (it == linksMap.end()) {
			throw RequestException(http_status::not_found, "Link not found");
		}

		auto& link = it->second;

		auto active = JsonUtil::getOptionalField<bool>("active", reqJson);
		if (active) link.active = *active;

		auto password = JsonUtil::getOptionalField<string>("password", reqJson);
		if (password) link.password = *password;

		auto allowedUsers = JsonUtil::getOptionalField<StringList>("allowed_users", reqJson);
		if (allowedUsers) link.allowedUsers = *allowedUsers;

		auto maxDownloads = JsonUtil::getOptionalField<int64_t>("max_downloads", reqJson);
		if (maxDownloads) link.maxDownloads = *maxDownloads;

		auto access = JsonUtil::getOptionalField<string>("access", reqJson);
		if (access) link.access = stringToAccess(*access);

		linksDirty = true;
		saveLinks();

		aRequest.setResponseBody(serializeLink(link));
		return http_status::ok;
	}

	api_return ShareLinkApi::handleDeleteLink(ApiRequest& aRequest) {
		const auto& linkId = aRequest.getStringParam("link_id");

		WLock l(linksMutex);
		auto it = linksMap.find(linkId);
		if (it == linksMap.end()) {
			throw RequestException(http_status::not_found, "Link not found");
		}

		linksMap.erase(it);
		linksDirty = true;
		saveLinks();

		return http_status::no_content;
	}

	api_return ShareLinkApi::handlePublicDownload(ApiRequest& aRequest) {
		const auto& linkId = aRequest.getPathTokenAt(0);

		RLock l(linksMutex);
		auto it = linksMap.find(linkId);
		if (it == linksMap.end()) {
			aRequest.setResponseErrorStr("Link not found");
			return http_status::not_found;
		}

		const auto& link = it->second;

		if (!link.active) {
			aRequest.setResponseErrorStr("This link has been deactivated");
			return http_status::gone;
		}

		if (link.expiresAt > 0 && GET_TIME() > link.expiresAt) {
			aRequest.setResponseErrorStr("This link has expired");
			return http_status::gone;
		}

		if (link.maxDownloads > 0 && link.downloadCount >= link.maxDownloads) {
			aRequest.setResponseErrorStr("Download limit reached");
			return http_status::gone;
		}

		// Return link info (actual file serving handled by FileServer)
		aRequest.setResponseBody({
			{ "id", link.id },
			{ "path", link.path },
			{ "virtual_name", link.virtualName },
			{ "access", accessToString(link.access) },
			{ "has_password", !link.password.empty() },
		});
		return http_status::ok;
	}
}
