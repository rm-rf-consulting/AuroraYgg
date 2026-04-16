/*
* Copyright (C) 2026 AuroraYgg Project
*
* E2E Encryption API — manage encryption keys, verify peers,
* and control encrypted channels using the Noise protocol framework.
*/

#ifndef DCPLUSPLUS_DCPP_ENCRYPTION_API_H
#define DCPLUSPLUS_DCPP_ENCRYPTION_API_H

#include <api/base/ApiModule.h>

namespace webserver {

	// Encryption key pair for a user
	struct KeyPair {
		string publicKey;   // Ed25519 public key (base64)
		string fingerprint; // Short fingerprint for verification
		time_t createdAt;
	};

	// Verified peer identity
	struct VerifiedPeer {
		string cid;         // DC++ Client ID
		string nick;
		string publicKey;   // Their public key
		string fingerprint;
		time_t verifiedAt;
		string trustLevel;  // "verified", "trusted", "unknown"

		using List = vector<VerifiedPeer>;
	};

	class EncryptionApi : public ApiModule {
	public:
		EncryptionApi(Session* aSession);
		~EncryptionApi() override;

	private:
		// Key management
		api_return handleGetOwnKey(ApiRequest& aRequest);
		api_return handleGenerateKey(ApiRequest& aRequest);
		api_return handleExportKey(ApiRequest& aRequest);

		// Peer verification
		api_return handleGetVerifiedPeers(ApiRequest& aRequest);
		api_return handleVerifyPeer(ApiRequest& aRequest);
		api_return handleRevokePeer(ApiRequest& aRequest);

		// Encryption status
		api_return handleGetStatus(ApiRequest& aRequest);
		api_return handleSetEnabled(ApiRequest& aRequest);

		// Storage
		static void loadKeys();
		static void saveKeys();

		static SharedMutex keysMutex;
		static optional<KeyPair> ownKeyPair;
		static VerifiedPeer::List verifiedPeers;
		static bool encryptionEnabled;
	};
}

#endif
