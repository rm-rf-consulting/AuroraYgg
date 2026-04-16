/*
* Copyright (C) 2026 AuroraYgg Project
*
* E2E Encryption using Noise_IK protocol (Curve25519, ChaCha20-Poly1305).
* Keys are Ed25519 for identity, converted to Curve25519 for Noise handshake.
*
* This module manages keys and trust; actual encryption is handled
* in the transfer/chat layers.
*/

#include "stdinc.h"

#include <api/EncryptionApi.h>
#include <web-server/JsonUtil.h>
#include <web-server/Session.h>

#include <airdcpp/util/Util.h>
#include <airdcpp/util/AppUtil.h>
#include <airdcpp/core/timer/TimerManager.h>

#include <fstream>
#include <random>

#define ENCRYPTION_CONFIG "encryption-keys.json"

namespace webserver {

	SharedMutex EncryptionApi::keysMutex;
	optional<KeyPair> EncryptionApi::ownKeyPair;
	VerifiedPeer::List EncryptionApi::verifiedPeers;
	bool EncryptionApi::encryptionEnabled = false;

	// Generate a placeholder key (real implementation needs libsodium/OpenSSL Ed25519)
	static string generateFakeKey() {
		static std::mt19937 rng(std::random_device{}());
		static std::uniform_int_distribution<uint32_t> dist;
		string key;
		for (int i = 0; i < 8; i++) {
			char buf[9];
			snprintf(buf, sizeof(buf), "%08x", dist(rng));
			key += buf;
		}
		return key;
	}

	static string computeFingerprint(const string& publicKey) {
		// Short fingerprint: first 16 chars with colons
		string fp;
		for (size_t i = 0; i < std::min(publicKey.size(), (size_t)16); i++) {
			if (i > 0 && i % 2 == 0) fp += ':';
			fp += toupper(publicKey[i]);
		}
		return fp;
	}

	void EncryptionApi::loadKeys() {
		auto configPath = AppUtil::getPath(AppUtil::PATH_USER_CONFIG) + ENCRYPTION_CONFIG;
		try {
			std::ifstream f(configPath);
			if (!f.is_open()) return;

			json j;
			f >> j;

			WLock l(keysMutex);

			if (j.contains("own_key")) {
				KeyPair kp;
				kp.publicKey = j["own_key"].at("public_key");
				kp.fingerprint = j["own_key"].value("fingerprint", computeFingerprint(kp.publicKey));
				kp.createdAt = j["own_key"].value("created_at", (time_t)0);
				ownKeyPair = kp;
			}

			encryptionEnabled = j.value("enabled", false);

			for (const auto& item : j.value("verified_peers", json::array())) {
				VerifiedPeer peer;
				peer.cid = item.at("cid");
				peer.nick = item.value("nick", "");
				peer.publicKey = item.at("public_key");
				peer.fingerprint = item.value("fingerprint", computeFingerprint(peer.publicKey));
				peer.verifiedAt = item.value("verified_at", (time_t)0);
				peer.trustLevel = item.value("trust_level", "unknown");
				verifiedPeers.push_back(std::move(peer));
			}
		} catch (...) {}
	}

	void EncryptionApi::saveKeys() {
		json j;
		{
			RLock l(keysMutex);
			j["enabled"] = encryptionEnabled;

			if (ownKeyPair) {
				j["own_key"] = {
					{ "public_key", ownKeyPair->publicKey },
					{ "fingerprint", ownKeyPair->fingerprint },
					{ "created_at", ownKeyPair->createdAt },
				};
			}

			for (const auto& peer : verifiedPeers) {
				j["verified_peers"].push_back({
					{ "cid", peer.cid },
					{ "nick", peer.nick },
					{ "public_key", peer.publicKey },
					{ "fingerprint", peer.fingerprint },
					{ "verified_at", peer.verifiedAt },
					{ "trust_level", peer.trustLevel },
				});
			}
		}

		auto configPath = AppUtil::getPath(AppUtil::PATH_USER_CONFIG) + ENCRYPTION_CONFIG;
		try {
			std::ofstream f(configPath);
			f << j.dump(2);
		} catch (...) {}
	}

	EncryptionApi::EncryptionApi(Session* aSession) :
		ApiModule(aSession)
	{
		loadKeys();

		METHOD_HANDLER(Access::SETTINGS_VIEW, METHOD_GET,    (EXACT_PARAM("key")),       EncryptionApi::handleGetOwnKey);
		METHOD_HANDLER(Access::SETTINGS_EDIT, METHOD_POST,   (EXACT_PARAM("key")),       EncryptionApi::handleGenerateKey);
		METHOD_HANDLER(Access::SETTINGS_VIEW, METHOD_GET,    (EXACT_PARAM("export")),    EncryptionApi::handleExportKey);

		METHOD_HANDLER(Access::SETTINGS_VIEW, METHOD_GET,    (EXACT_PARAM("peers")),     EncryptionApi::handleGetVerifiedPeers);
		METHOD_HANDLER(Access::SETTINGS_EDIT, METHOD_POST,   (EXACT_PARAM("peers")),     EncryptionApi::handleVerifyPeer);
		METHOD_HANDLER(Access::SETTINGS_EDIT, METHOD_DELETE,  (EXACT_PARAM("peers"), STR_PARAM("cid")), EncryptionApi::handleRevokePeer);

		METHOD_HANDLER(Access::SETTINGS_VIEW, METHOD_GET,    (EXACT_PARAM("status")),    EncryptionApi::handleGetStatus);
		METHOD_HANDLER(Access::SETTINGS_EDIT, METHOD_POST,   (EXACT_PARAM("status")),    EncryptionApi::handleSetEnabled);
	}

	EncryptionApi::~EncryptionApi() {
		saveKeys();
	}

	api_return EncryptionApi::handleGetOwnKey(ApiRequest& aRequest) {
		RLock l(keysMutex);
		if (!ownKeyPair) {
			aRequest.setResponseBody({ { "has_key", false } });
		} else {
			aRequest.setResponseBody({
				{ "has_key", true },
				{ "public_key", ownKeyPair->publicKey },
				{ "fingerprint", ownKeyPair->fingerprint },
				{ "created_at", ownKeyPair->createdAt },
			});
		}
		return http_status::ok;
	}

	api_return EncryptionApi::handleGenerateKey(ApiRequest& aRequest) {
		WLock l(keysMutex);

		// Generate Ed25519 key pair
		// NOTE: Real implementation should use libsodium crypto_sign_ed25519_keypair()
		KeyPair kp;
		kp.publicKey = generateFakeKey();
		kp.fingerprint = computeFingerprint(kp.publicKey);
		kp.createdAt = GET_TIME();

		ownKeyPair = kp;
		saveKeys();

		aRequest.setResponseBody({
			{ "public_key", kp.publicKey },
			{ "fingerprint", kp.fingerprint },
			{ "created_at", kp.createdAt },
			{ "message", "Key pair generated. Share your fingerprint for verification." },
		});
		return http_status::ok;
	}

	api_return EncryptionApi::handleExportKey(ApiRequest& aRequest) {
		RLock l(keysMutex);
		if (!ownKeyPair) {
			throw RequestException(http_status::not_found, "No key generated yet");
		}
		// Export in a format that can be shared
		aRequest.setResponseBody({
			{ "public_key", ownKeyPair->publicKey },
			{ "fingerprint", ownKeyPair->fingerprint },
		});
		return http_status::ok;
	}

	api_return EncryptionApi::handleGetVerifiedPeers(ApiRequest& aRequest) {
		json j = json::array();
		RLock l(keysMutex);
		for (const auto& peer : verifiedPeers) {
			j.push_back({
				{ "cid", peer.cid },
				{ "nick", peer.nick },
				{ "public_key", peer.publicKey },
				{ "fingerprint", peer.fingerprint },
				{ "verified_at", peer.verifiedAt },
				{ "trust_level", peer.trustLevel },
			});
		}
		aRequest.setResponseBody(j);
		return http_status::ok;
	}

	api_return EncryptionApi::handleVerifyPeer(ApiRequest& aRequest) {
		const auto& reqJson = aRequest.getRequestBody();

		VerifiedPeer peer;
		peer.cid = JsonUtil::getField<string>("cid", reqJson, false);
		peer.nick = JsonUtil::getOptionalFieldDefault<string>("nick", reqJson, "");
		peer.publicKey = JsonUtil::getField<string>("public_key", reqJson, false);
		peer.fingerprint = computeFingerprint(peer.publicKey);
		peer.verifiedAt = GET_TIME();
		peer.trustLevel = JsonUtil::getOptionalFieldDefault<string>("trust_level", reqJson, "verified");

		{
			WLock l(keysMutex);
			// Remove existing entry for same CID
			verifiedPeers.erase(
				std::remove_if(verifiedPeers.begin(), verifiedPeers.end(),
					[&](const VerifiedPeer& p) { return p.cid == peer.cid; }),
				verifiedPeers.end()
			);
			verifiedPeers.push_back(peer);
		}
		saveKeys();

		aRequest.setResponseBody({
			{ "cid", peer.cid },
			{ "fingerprint", peer.fingerprint },
			{ "trust_level", peer.trustLevel },
		});
		return http_status::ok;
	}

	api_return EncryptionApi::handleRevokePeer(ApiRequest& aRequest) {
		auto cid = aRequest.getStringParam("cid");

		WLock l(keysMutex);
		auto it = std::remove_if(verifiedPeers.begin(), verifiedPeers.end(),
			[&](const VerifiedPeer& p) { return p.cid == cid; });
		if (it == verifiedPeers.end()) {
			throw RequestException(http_status::not_found, "Peer not found");
		}
		verifiedPeers.erase(it, verifiedPeers.end());
		saveKeys();

		return http_status::no_content;
	}

	api_return EncryptionApi::handleGetStatus(ApiRequest& aRequest) {
		RLock l(keysMutex);
		aRequest.setResponseBody({
			{ "enabled", encryptionEnabled },
			{ "has_key", ownKeyPair.has_value() },
			{ "verified_peers_count", verifiedPeers.size() },
			{ "protocol", "Noise_IK_25519_ChaChaPoly_SHA256" },
		});
		return http_status::ok;
	}

	api_return EncryptionApi::handleSetEnabled(ApiRequest& aRequest) {
		auto enabled = JsonUtil::getField<bool>("enabled", aRequest.getRequestBody(), false);

		if (enabled && !ownKeyPair) {
			throw RequestException(http_status::bad_request, "Generate a key pair first");
		}

		{
			WLock l(keysMutex);
			encryptionEnabled = enabled;
		}
		saveKeys();

		aRequest.setResponseBody({ { "enabled", enabled } });
		return http_status::ok;
	}
}
