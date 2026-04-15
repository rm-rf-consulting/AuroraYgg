/*
* Copyright (C) 2011-2024 AirDC++ Project
*
* This program is free software; you can redistribute it and/or modify
* it under the terms of the GNU General Public License as published by
* the Free Software Foundation; either version 3 of the License, or
* (at your option) any later version.
*
* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU General Public License for more details.
*
* You should have received a copy of the GNU General Public License
* along with this program; if not, write to the Free Software
* Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307, USA.
*/

#include "stdinc.h"

#include <api/WebUserApi.h>
#include <api/WebUserUtils.h>

#include <api/common/Serializer.h>
#include <api/common/Deserializer.h>

#include <web-server/JsonUtil.h>
#include <web-server/Session.h>
#include <web-server/WebUserManager.h>
#include <web-server/WebServerManager.h>

#define USERNAME_PARAM "username"
namespace webserver {
	WebUserApi::WebUserApi(Session* aSession) : 
		SubscribableApiModule(aSession, Access::ADMIN),
		view("web_user_view", this, WebUserUtils::propertyHandler, std::bind(&WebUserApi::getUsers, this)),
		um(aSession->getServer()->getUserManager()) 
	{
		createSubscriptions({ "web_user_added", "web_user_updated", "web_user_removed" });

		METHOD_HANDLER(Access::ADMIN, METHOD_GET,		(),								WebUserApi::handleGetUsers);
		METHOD_HANDLER(Access::ADMIN, METHOD_POST,		(),								WebUserApi::handleAddUser);

		// Invite system (EXACT_PARAM must come BEFORE STR_PARAM to avoid "invites" being matched as username)
		METHOD_HANDLER(Access::ADMIN, METHOD_GET,		(EXACT_PARAM("invites")),						WebUserApi::handleGetInvites);
		METHOD_HANDLER(Access::ADMIN, METHOD_POST,		(EXACT_PARAM("invites")),						WebUserApi::handleCreateInvite);
		METHOD_HANDLER(Access::ADMIN, METHOD_DELETE,	(EXACT_PARAM("invites"), STR_PARAM("code")),	WebUserApi::handleRemoveInvite);

		// User management (STR_PARAM after EXACT_PARAM)
		METHOD_HANDLER(Access::ADMIN, METHOD_GET,		(STR_PARAM(USERNAME_PARAM)),	WebUserApi::handleGetUser);
		METHOD_HANDLER(Access::ADMIN, METHOD_PATCH,		(STR_PARAM(USERNAME_PARAM)),	WebUserApi::handleUpdateUser);
		METHOD_HANDLER(Access::ADMIN, METHOD_DELETE,	(STR_PARAM(USERNAME_PARAM)),	WebUserApi::handleRemoveUser);

		um.addListener(this);
	}

	WebUserApi::~WebUserApi() {
		um.removeListener(this);
	}

	WebUserList WebUserApi::getUsers() const noexcept {
		return um.getUsers();
	}

	api_return WebUserApi::handleGetUsers(ApiRequest& aRequest) {
		auto j = Serializer::serializeItemList(WebUserUtils::propertyHandler, getUsers());
		aRequest.setResponseBody(j);
		return http_status::ok;
	}

	WebUserPtr WebUserApi::parseUserNameParam(ApiRequest& aRequest) {
		const auto& userName = aRequest.getStringParam(USERNAME_PARAM);
		auto user = um.getUser(userName);
		if (!user) {
			throw RequestException(http_status::not_found, "User " + userName + " was not found");
		}

		return user;
	}

	api_return WebUserApi::handleGetUser(ApiRequest& aRequest) {
		const auto& user = parseUserNameParam(aRequest);

		aRequest.setResponseBody(Serializer::serializeItem(user, WebUserUtils::propertyHandler));
		return http_status::ok;
	}

	bool WebUserApi::updateUserProperties(WebUserPtr& aUser, const json& j, bool aIsNew) {
		auto hasChanges = false;

		{
			auto password = JsonUtil::getOptionalField<string>("password", j, aIsNew);
			if (password) {
				aUser->setPassword(*password);
				hasChanges = true;
			}
		}

		{
			auto permissions = JsonUtil::getOptionalField<StringList>("permissions", j);
			if (permissions) {
				aUser->setPermissions(*permissions);
				hasChanges = true;
			}
		}

		return hasChanges;
	}

	api_return WebUserApi::handleAddUser(ApiRequest& aRequest) {
		const auto& reqJson = aRequest.getRequestBody();

		auto userName = JsonUtil::getField<string>("username", reqJson, false);
		if (!WebUser::validateUsername(userName)) {
			JsonUtil::throwError("username", JsonException::ERROR_INVALID, "The username should only contain alphanumeric characters");
		}

		auto user = std::make_shared<WebUser>(userName, Util::emptyString);

		updateUserProperties(user, reqJson, true);

		if (!um.addUser(user)) {
			JsonUtil::throwError("username", JsonException::ERROR_EXISTS, "User with the same name exists already");
		}

		aRequest.setResponseBody(Serializer::serializeItem(user, WebUserUtils::propertyHandler));
		return http_status::ok;
	}

	api_return WebUserApi::handleUpdateUser(ApiRequest& aRequest) {
		const auto& reqJson = aRequest.getRequestBody();
		auto user = parseUserNameParam(aRequest);

		auto hasChanges = updateUserProperties(user, reqJson, false);
		if (hasChanges) {
			um.updateUser(user, aRequest.getSession()->getUser() != user);
		}

		aRequest.setResponseBody(Serializer::serializeItem(user, WebUserUtils::propertyHandler));
		return http_status::ok;
	}

	api_return WebUserApi::handleRemoveUser(ApiRequest& aRequest) {
		const auto& userName = aRequest.getStringParam(USERNAME_PARAM);
		if (!um.removeUser(userName)) {
			aRequest.setResponseErrorStr("User " + userName + " was not found");
			return http_status::not_found;
		}

		return http_status::no_content;
	}

	// Invite handlers
	api_return WebUserApi::handleGetInvites(ApiRequest& aRequest) {
		auto invites = um.getInvites();
		json j = json::array();
		for (const auto& inv : invites) {
			j.push_back({
				{ "code", inv.code },
				{ "created_by", inv.createdBy },
				{ "created_at", inv.createdAt },
				{ "expires_at", inv.expiresAt },
				{ "permissions", inv.permissions },
				{ "used", inv.used },
				{ "used_by", inv.usedBy },
			});
		}
		aRequest.setResponseBody(j);
		return http_status::ok;
	}

	api_return WebUserApi::handleCreateInvite(ApiRequest& aRequest) {
		const auto& reqJson = aRequest.getRequestBody();
		auto permissions = JsonUtil::getOptionalField<StringList>("permissions", reqJson);
		auto expiresHours = JsonUtil::getOptionalField<int>("expires_hours", reqJson);

		StringList perms = permissions.value_or(StringList{ "search", "download", "transfers", "hubs_view", "hubs_send", "queue_view", "share_view", "events_view", "favorite_hubs_view", "private_chat_view", "private_chat_send", "filelists_view" });
		int hours = expiresHours.value_or(72);

		auto createdBy = aRequest.getSession()->getUser()->getUserName();
		auto code = um.createInvite(createdBy, perms, hours);

		aRequest.setResponseBody({
			{ "code", code },
			{ "expires_hours", hours },
		});
		return http_status::ok;
	}

	api_return WebUserApi::handleRemoveInvite(ApiRequest& aRequest) {
		const auto& code = aRequest.getStringParam("code");
		if (!um.removeInvite(code)) {
			aRequest.setResponseErrorStr("Invite code not found");
			return http_status::not_found;
		}
		return http_status::no_content;
	}

	api_return WebUserApi::handleRedeemInvitePublic(ApiRequest& aRequest) {
		const auto& reqJson = aRequest.getRequestBody();
		auto code = JsonUtil::getField<string>("invite_code", reqJson, false);
		auto username = JsonUtil::getField<string>("username", reqJson, false);
		auto password = JsonUtil::getField<string>("password", reqJson, false);

		auto& um = WebServerManager::getInstance()->getUserManager();

		try {
			auto user = um.redeemInvite(code, username, password);
			aRequest.setResponseBody({
				{ "username", user->getUserName() },
				{ "message", "Account created successfully" },
			});
			return http_status::ok;
		} catch (const std::domain_error& e) {
			aRequest.setResponseErrorStr(e.what());
			return http_status::bad_request;
		}
	}

	void WebUserApi::on(WebUserManagerListener::UserAdded, const WebUserPtr& aUser) noexcept {
		view.onItemAdded(aUser);

		maybeSend("web_user_added", [&] { 
			return Serializer::serializeItem(aUser, WebUserUtils::propertyHandler); 
		});
	}

	void WebUserApi::on(WebUserManagerListener::UserUpdated, const WebUserPtr& aUser) noexcept {
		view.onItemUpdated(aUser, toPropertyIdSet(WebUserUtils::properties));

		maybeSend("web_user_updated", [&] { 
			return Serializer::serializeItem(aUser, WebUserUtils::propertyHandler); 
		});
	}

	void WebUserApi::on(WebUserManagerListener::UserRemoved, const WebUserPtr& aUser) noexcept {
		view.onItemRemoved(aUser);

		maybeSend("web_user_removed", [&] { 
			return Serializer::serializeItem(aUser, WebUserUtils::propertyHandler); 
		});
	}
}