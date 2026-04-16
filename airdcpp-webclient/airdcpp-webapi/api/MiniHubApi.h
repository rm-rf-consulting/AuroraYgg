/*
* Copyright (C) 2026 AuroraYgg Project
*
* Mini-Hub API — run a lightweight ADC hub directly in the client.
* Enables P2P file sharing without a central hub server.
*
* Features:
* - Embedded ADC hub on configurable port
* - Auto-announce on Yggdrasil multicast
* - Direct peer-to-peer connections
* - Invite-based or open access
*/

#ifndef DCPLUSPLUS_DCPP_MINIHUB_API_H
#define DCPLUSPLUS_DCPP_MINIHUB_API_H

#include <api/base/ApiModule.h>
#include <airdcpp/core/thread/CriticalSection.h>

namespace webserver {

	struct MiniHubConfig {
		string name;
		string description;
		int port;                // ADC listen port (default: 1511)
		bool enabled;
		string accessMode;       // "open", "password", "invite"
		string password;
		int maxUsers;
		bool announceOnYggdrasil; // Announce via multicast discovery
	};

	struct MiniHubPeer {
		string cid;
		string nick;
		string ip;
		int64_t shareSize;
		time_t connectedAt;

		using List = vector<MiniHubPeer>;
	};

	class MiniHubApi : public ApiModule {
	public:
		MiniHubApi(Session* aSession);
		~MiniHubApi() override;

	private:
		api_return handleGetStatus(ApiRequest& aRequest);
		api_return handleStart(ApiRequest& aRequest);
		api_return handleStop(ApiRequest& aRequest);
		api_return handleGetConfig(ApiRequest& aRequest);
		api_return handleUpdateConfig(ApiRequest& aRequest);
		api_return handleGetPeers(ApiRequest& aRequest);
		api_return handleKickPeer(ApiRequest& aRequest);

		static SharedMutex hubMutex;
		static MiniHubConfig config;
		static MiniHubPeer::List connectedPeers;
		static bool running;

		static void loadConfig();
		static void saveConfig();
	};
}

#endif
