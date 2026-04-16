/*
* Copyright (C) 2026 AuroraYgg Project
*
* Hub Discovery — find hubs via bootstrap, multicast, peer exchange.
*
* Bootstrap: query known nodes for their hub lists
* Multicast: send UDP probe on Yggdrasil multicast group
* Peer Exchange: connected hubs share their known hub lists
*/

#include "stdinc.h"

#include <api/HubDiscoveryApi.h>
#include <web-server/JsonUtil.h>
#include <web-server/Session.h>

#include <airdcpp/util/Util.h>
#include <airdcpp/util/AppUtil.h>

#include <fstream>

#define DISCOVERY_CONFIG "hub-discovery.json"

// Default bootstrap nodes on Yggdrasil
static const webserver::StringList DEFAULT_BOOTSTRAP = {
	"adc://[200::1]:1511",  // Placeholder — real bootstrap TBD
};

namespace webserver {

	SharedMutex HubDiscoveryApi::discoveryMutex;
	DiscoveredHub::List HubDiscoveryApi::discoveredHubs;
	StringList HubDiscoveryApi::bootstrapNodes;
	bool HubDiscoveryApi::discoveryDirty = false;

	static json serializeHub(const DiscoveredHub& hub) {
		return {
			{ "url", hub.url },
			{ "name", hub.name },
			{ "description", hub.description },
			{ "user_count", hub.userCount },
			{ "share_size", hub.shareSize },
			{ "last_seen", hub.lastSeen },
			{ "source", hub.source },
		};
	}

	void HubDiscoveryApi::loadDiscoveryData() {
		auto configPath = AppUtil::getPath(AppUtil::PATH_USER_CONFIG) + DISCOVERY_CONFIG;
		try {
			std::ifstream f(configPath);
			if (!f.is_open()) {
				bootstrapNodes = DEFAULT_BOOTSTRAP;
				return;
			}

			json j;
			f >> j;

			WLock l(discoveryMutex);

			// Load bootstrap nodes
			bootstrapNodes = j.value("bootstrap_nodes", DEFAULT_BOOTSTRAP);

			// Load cached discovered hubs
			for (const auto& item : j.value("discovered_hubs", json::array())) {
				DiscoveredHub hub;
				hub.url = item.at("url");
				hub.name = item.value("name", "");
				hub.description = item.value("description", "");
				hub.userCount = item.value("user_count", 0);
				hub.shareSize = item.value("share_size", (int64_t)0);
				hub.lastSeen = item.value("last_seen", (time_t)0);
				hub.source = item.value("source", "cached");
				discoveredHubs.push_back(std::move(hub));
			}
		} catch (...) {
			bootstrapNodes = DEFAULT_BOOTSTRAP;
		}
	}

	void HubDiscoveryApi::saveDiscoveryData() {
		if (!discoveryDirty) return;
		discoveryDirty = false;

		json j;
		{
			RLock l(discoveryMutex);
			j["bootstrap_nodes"] = bootstrapNodes;

			for (const auto& hub : discoveredHubs) {
				j["discovered_hubs"].push_back(serializeHub(hub));
			}
		}

		auto configPath = AppUtil::getPath(AppUtil::PATH_USER_CONFIG) + DISCOVERY_CONFIG;
		try {
			std::ofstream f(configPath);
			f << j.dump(2);
		} catch (...) {}
	}

	HubDiscoveryApi::HubDiscoveryApi(Session* aSession) :
		ApiModule(aSession)
	{
		loadDiscoveryData();

		METHOD_HANDLER(Access::HUBS_VIEW, METHOD_GET,     (EXACT_PARAM("hubs")),                  HubDiscoveryApi::handleGetDiscoveredHubs);
		METHOD_HANDLER(Access::HUBS_EDIT, METHOD_POST,    (EXACT_PARAM("refresh")),               HubDiscoveryApi::handleRefreshDiscovery);
		METHOD_HANDLER(Access::HUBS_VIEW, METHOD_GET,     (EXACT_PARAM("bootstrap")),             HubDiscoveryApi::handleGetBootstrapNodes);
		METHOD_HANDLER(Access::HUBS_EDIT, METHOD_POST,    (EXACT_PARAM("bootstrap")),             HubDiscoveryApi::handleAddBootstrapNode);
		METHOD_HANDLER(Access::HUBS_EDIT, METHOD_DELETE,  (EXACT_PARAM("bootstrap"), STR_PARAM("url")), HubDiscoveryApi::handleRemoveBootstrapNode);
	}

	HubDiscoveryApi::~HubDiscoveryApi() {
		saveDiscoveryData();
	}

	api_return HubDiscoveryApi::handleGetDiscoveredHubs(ApiRequest& aRequest) {
		json j = json::array();
		RLock l(discoveryMutex);
		for (const auto& hub : discoveredHubs) {
			j.push_back(serializeHub(hub));
		}
		aRequest.setResponseBody(j);
		return http_status::ok;
	}

	api_return HubDiscoveryApi::handleRefreshDiscovery(ApiRequest& aRequest) {
		// Trigger all discovery methods
		queryBootstrapNodes();
		sendMulticastProbe();
		exchangeWithPeers();

		aRequest.setResponseBody({
			{ "message", "Discovery refresh initiated" },
			{ "methods", json::array({"bootstrap", "multicast", "peer_exchange"}) },
		});
		return http_status::ok;
	}

	api_return HubDiscoveryApi::handleGetBootstrapNodes(ApiRequest& aRequest) {
		RLock l(discoveryMutex);
		aRequest.setResponseBody(json(bootstrapNodes));
		return http_status::ok;
	}

	api_return HubDiscoveryApi::handleAddBootstrapNode(ApiRequest& aRequest) {
		auto url = JsonUtil::getField<string>("url", aRequest.getRequestBody(), false);

		{
			WLock l(discoveryMutex);
			if (std::find(bootstrapNodes.begin(), bootstrapNodes.end(), url) == bootstrapNodes.end()) {
				bootstrapNodes.push_back(url);
				discoveryDirty = true;
			}
		}
		saveDiscoveryData();

		aRequest.setResponseBody({ { "url", url } });
		return http_status::ok;
	}

	api_return HubDiscoveryApi::handleRemoveBootstrapNode(ApiRequest& aRequest) {
		auto url = aRequest.getStringParam("url");

		WLock l(discoveryMutex);
		auto it = std::find(bootstrapNodes.begin(), bootstrapNodes.end(), url);
		if (it != bootstrapNodes.end()) {
			bootstrapNodes.erase(it);
			discoveryDirty = true;
			saveDiscoveryData();
		}

		return http_status::no_content;
	}

	// Discovery implementations

	void HubDiscoveryApi::queryBootstrapNodes() {
		// TODO: Implement HTTP/ADC query to bootstrap nodes
		// Each bootstrap node should respond with its known hub list
		// For now, this is a placeholder for the protocol implementation
		//
		// Protocol:
		//   POST adc://[bootstrap_addr]:port/hub_list
		//   Response: JSON array of { url, name, user_count, share_size }
	}

	void HubDiscoveryApi::sendMulticastProbe() {
		// TODO: Implement Yggdrasil multicast discovery
		// Send a UDP packet to a well-known Yggdrasil multicast group
		// Hubs with discovery enabled will respond with their info
		//
		// Multicast group: ff02::aurora:dc (TBD)
		// Payload: { "type": "hub_probe", "client": "AuroraYgg/0.2.0" }
	}

	void HubDiscoveryApi::exchangeWithPeers() {
		// TODO: Implement peer exchange
		// Ask currently connected hubs for their known hub list
		// This is an extension to the ADC protocol:
		//   BINF ... EX aurora:hub_exchange
		//   Response: hub list from the hub's network
	}
}
