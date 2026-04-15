/*
* Copyright (C) 2026 AuroraYgg Project
*
* This program is free software; you can redistribute it and/or modify
* it under the terms of the GNU General Public License as published by
* the Free Software Foundation; either version 3 of the License, or
* (at your option) any later version.
*/

#ifndef DCPLUSPLUS_DCPP_SHARELINK_API_H
#define DCPLUSPLUS_DCPP_SHARELINK_API_H

#include <api/base/ApiModule.h>
#include <web-server/WebUserManager.h>

namespace webserver {

	// Access control for a shared link
	enum class ShareLinkAccess {
		PUBLIC,       // Anyone with the link
		PASSWORD,     // Requires password
		INVITE_ONLY,  // Requires valid invite code
		USERS_ONLY,   // Specific whitelisted users
	};

	struct ShareLink {
		string id;            // UUID
		string path;          // Filesystem path to file/directory
		string virtualName;   // User-facing name
		string createdBy;     // Username of creator
		time_t createdAt;
		time_t expiresAt;     // 0 = never expires
		ShareLinkAccess access;
		string password;      // For PASSWORD access (Tiger hashed)
		StringList allowedUsers; // For USERS_ONLY access
		int64_t downloadCount;
		int64_t maxDownloads;  // 0 = unlimited
		bool active;

		using List = vector<ShareLink>;
		using Ptr = shared_ptr<ShareLink>;
	};

	class ShareLinkApi : public ApiModule {
	public:
		ShareLinkApi(Session* aSession);
		~ShareLinkApi() override;

		// Public download endpoint (called from ApiRouter without auth)
		static api_return handlePublicDownload(ApiRequest& aRequest);

	private:
		api_return handleGetLinks(ApiRequest& aRequest);
		api_return handleCreateLink(ApiRequest& aRequest);
		api_return handleGetLink(ApiRequest& aRequest);
		api_return handleUpdateLink(ApiRequest& aRequest);
		api_return handleDeleteLink(ApiRequest& aRequest);
	};
}

#endif
