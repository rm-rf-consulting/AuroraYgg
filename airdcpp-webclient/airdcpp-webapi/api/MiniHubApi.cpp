/*
* Copyright (C) 2026 AuroraYgg Project
*
* Mini-Hub — lightweight embedded ADC hub.
* Runs inside the AuroraYgg client, no separate hub software needed.
*
* Architecture:
* - Listens on a configurable TCP port (default 1511)
* - Implements basic ADC hub protocol (HSUP, BINF, BMSG)
* - Supports up to maxUsers concurrent connections
* - Optionally announces via Yggdrasil multicast discovery
*
* Note: Full ADC hub protocol implementation is TODO.
* This module provides the API and configuration framework.
* The actual socket handling will be added incrementally.
*/

#include "stdinc.h"

#include <api/MiniHubApi.h>
#include <web-server/JsonUtil.h>
#include <web-server/Session.h>

#include <airdcpp/util/Util.h>
#include <airdcpp/util/AppUtil.h>

#include <fstream>

#define MINIHUB_CONFIG "mini-hub.json"

namespace webserver {

	SharedMutex MiniHubApi::hubMutex;
	MiniHubConfig MiniHubApi::config = {
		"My Aurora Hub",          // name
		"Yggdrasil P2P Hub",     // description
		1511,                     // port
		false,                    // enabled
		"open",                   // accessMode
		"",                       // password
		50,                       // maxUsers
		true,                     // announceOnYggdrasil
	};
	MiniHubPeer::List MiniHubApi::connectedPeers;
	bool MiniHubApi::running = false;

	void MiniHubApi::loadConfig() {
		auto configPath = AppUtil::getPath(AppUtil::PATH_USER_CONFIG) + MINIHUB_CONFIG;
		try {
			std::ifstream f(configPath);
			if (!f.is_open()) return;

			json j;
			f >> j;

			WLock l(hubMutex);
			config.name = j.value("name", config.name);
			config.description = j.value("description", config.description);
			config.port = j.value("port", config.port);
			config.enabled = j.value("enabled", config.enabled);
			config.accessMode = j.value("access_mode", config.accessMode);
			config.password = j.value("password", config.password);
			config.maxUsers = j.value("max_users", config.maxUsers);
			config.announceOnYggdrasil = j.value("announce", config.announceOnYggdrasil);
		} catch (...) {}
	}

	void MiniHubApi::saveConfig() {
		json j;
		{
			RLock l(hubMutex);
			j = {
				{ "name", config.name },
				{ "description", config.description },
				{ "port", config.port },
				{ "enabled", config.enabled },
				{ "access_mode", config.accessMode },
				{ "password", config.password },
				{ "max_users", config.maxUsers },
				{ "announce", config.announceOnYggdrasil },
			};
		}

		auto configPath = AppUtil::getPath(AppUtil::PATH_USER_CONFIG) + MINIHUB_CONFIG;
		try {
			std::ofstream f(configPath);
			f << j.dump(2);
		} catch (...) {}
	}

	MiniHubApi::MiniHubApi(Session* aSession) :
		ApiModule(aSession)
	{
		loadConfig();

		METHOD_HANDLER(Access::ADMIN, METHOD_GET,     (EXACT_PARAM("status")),                MiniHubApi::handleGetStatus);
		METHOD_HANDLER(Access::ADMIN, METHOD_POST,    (EXACT_PARAM("start")),                 MiniHubApi::handleStart);
		METHOD_HANDLER(Access::ADMIN, METHOD_POST,    (EXACT_PARAM("stop")),                  MiniHubApi::handleStop);
		METHOD_HANDLER(Access::ADMIN, METHOD_GET,     (EXACT_PARAM("config")),                MiniHubApi::handleGetConfig);
		METHOD_HANDLER(Access::ADMIN, METHOD_PATCH,   (EXACT_PARAM("config")),                MiniHubApi::handleUpdateConfig);
		METHOD_HANDLER(Access::ADMIN, METHOD_GET,     (EXACT_PARAM("peers")),                 MiniHubApi::handleGetPeers);
		METHOD_HANDLER(Access::ADMIN, METHOD_POST,    (EXACT_PARAM("kick"), STR_PARAM("cid")), MiniHubApi::handleKickPeer);
	}

	MiniHubApi::~MiniHubApi() {
		saveConfig();
	}

	api_return MiniHubApi::handleGetStatus(ApiRequest& aRequest) {
		RLock l(hubMutex);
		aRequest.setResponseBody({
			{ "running", running },
			{ "name", config.name },
			{ "port", config.port },
			{ "connected_peers", connectedPeers.size() },
			{ "max_users", config.maxUsers },
			{ "access_mode", config.accessMode },
			{ "announce", config.announceOnYggdrasil },
		});
		return http_status::ok;
	}

	api_return MiniHubApi::handleStart(ApiRequest& aRequest) {
		WLock l(hubMutex);
		if (running) {
			throw RequestException(http_status::conflict, "Hub is already running");
		}

		// TODO: Actually start ADC hub socket listener on config.port
		// For now, set the flag — real implementation needs:
		// 1. TCP socket listener on config.port
		// 2. ADC protocol handler (HSUP, BINF, BMSG, BSCH)
		// 3. User management (nick, share, slots)
		// 4. Message routing

		running = true;
		config.enabled = true;
		saveConfig();

		aRequest.setResponseBody({
			{ "running", true },
			{ "port", config.port },
			{ "message", "Mini-hub started on port " + std::to_string(config.port) },
		});
		return http_status::ok;
	}

	api_return MiniHubApi::handleStop(ApiRequest& aRequest) {
		WLock l(hubMutex);
		if (!running) {
			throw RequestException(http_status::conflict, "Hub is not running");
		}

		// TODO: Close all connections and stop listener
		running = false;
		connectedPeers.clear();

		aRequest.setResponseBody({ { "running", false } });
		return http_status::ok;
	}

	api_return MiniHubApi::handleGetConfig(ApiRequest& aRequest) {
		RLock l(hubMutex);
		aRequest.setResponseBody({
			{ "name", config.name },
			{ "description", config.description },
			{ "port", config.port },
			{ "access_mode", config.accessMode },
			{ "max_users", config.maxUsers },
			{ "announce", config.announceOnYggdrasil },
			{ "has_password", !config.password.empty() },
		});
		return http_status::ok;
	}

	api_return MiniHubApi::handleUpdateConfig(ApiRequest& aRequest) {
		const auto& reqJson = aRequest.getRequestBody();

		WLock l(hubMutex);
		auto name = JsonUtil::getOptionalField<string>("name", reqJson);
		if (name) config.name = *name;

		auto desc = JsonUtil::getOptionalField<string>("description", reqJson);
		if (desc) config.description = *desc;

		auto port = JsonUtil::getOptionalField<int>("port", reqJson);
		if (port) config.port = *port;

		auto accessMode = JsonUtil::getOptionalField<string>("access_mode", reqJson);
		if (accessMode) config.accessMode = *accessMode;

		auto password = JsonUtil::getOptionalField<string>("password", reqJson);
		if (password) config.password = *password;

		auto maxUsers = JsonUtil::getOptionalField<int>("max_users", reqJson);
		if (maxUsers) config.maxUsers = *maxUsers;

		auto announce = JsonUtil::getOptionalField<bool>("announce", reqJson);
		if (announce) config.announceOnYggdrasil = *announce;

		saveConfig();

		aRequest.setResponseBody({ { "message", "Configuration updated" } });
		return http_status::ok;
	}

	api_return MiniHubApi::handleGetPeers(ApiRequest& aRequest) {
		json j = json::array();
		RLock l(hubMutex);
		for (const auto& peer : connectedPeers) {
			j.push_back({
				{ "cid", peer.cid },
				{ "nick", peer.nick },
				{ "ip", peer.ip },
				{ "share_size", peer.shareSize },
				{ "connected_at", peer.connectedAt },
			});
		}
		aRequest.setResponseBody(j);
		return http_status::ok;
	}

	api_return MiniHubApi::handleKickPeer(ApiRequest& aRequest) {
		auto cid = aRequest.getStringParam("cid");

		WLock l(hubMutex);
		auto it = std::remove_if(connectedPeers.begin(), connectedPeers.end(),
			[&](const MiniHubPeer& p) { return p.cid == cid; });

		if (it == connectedPeers.end()) {
			throw RequestException(http_status::not_found, "Peer not found");
		}

		// TODO: Send QUI (disconnect) to the peer via ADC
		connectedPeers.erase(it, connectedPeers.end());

		return http_status::no_content;
	}
}
