/*
* Copyright (C) 2026 AuroraYgg Project
*
* Hub Discovery API — find DC++ hubs on the Yggdrasil network
* via bootstrap nodes, multicast, and peer exchange.
*/

#ifndef DCPLUSPLUS_DCPP_HUB_DISCOVERY_API_H
#define DCPLUSPLUS_DCPP_HUB_DISCOVERY_API_H

#include <api/base/ApiModule.h>
#include <airdcpp/core/thread/CriticalSection.h>

namespace webserver {

	struct DiscoveredHub {
		string url;           // adc://[200:...]:port
		string name;
		string description;
		int userCount;
		int64_t shareSize;
		time_t lastSeen;
		string source;        // "bootstrap", "multicast", "peer_exchange", "manual"

		using List = vector<DiscoveredHub>;
	};

	class HubDiscoveryApi : public ApiModule {
	public:
		HubDiscoveryApi(Session* aSession);
		~HubDiscoveryApi() override;

	private:
		api_return handleGetDiscoveredHubs(ApiRequest& aRequest);
		api_return handleRefreshDiscovery(ApiRequest& aRequest);
		api_return handleAddBootstrapNode(ApiRequest& aRequest);
		api_return handleGetBootstrapNodes(ApiRequest& aRequest);
		api_return handleRemoveBootstrapNode(ApiRequest& aRequest);

		// Discovery methods
		static void queryBootstrapNodes();
		static void sendMulticastProbe();
		static void exchangeWithPeers();

		// Storage
		static SharedMutex discoveryMutex;
		static DiscoveredHub::List discoveredHubs;
		static StringList bootstrapNodes;
		static bool discoveryDirty;

		static void loadDiscoveryData();
		static void saveDiscoveryData();
	};
}

#endif
