/*
 * Copyright (C) 2012-2021 AirDC++ Project
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
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

#include <airdcpp/DCPlusPlus.h>
#include <airdcpp/util/AppUtil.h>
#include <airdcpp/core/classes/Exception.h>
#include <airdcpp/util/Util.h>
#include <airdcpp/util/SystemUtil.h>
#include <airdcpp/core/version.h>
#include <airdcpp/core/io/File.h>

#include <web-server/WebServerManager.h>

#include "Client.h"
#include "ConfigPrompt.h"

#ifndef _WIN32
#include "stacktrace.h"
#endif

#include <signal.h>
#include <locale.h>
#include <fstream>

#ifdef _WIN32
#include <windows.h>
#include <io.h>
#include <openssl/applink.c>
#else
#include <limits.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/wait.h>
#endif


using namespace dcpp;

static std::unique_ptr<File> pidFile;
static std::string pidFileName;
static bool asdaemon = false;
static bool crashed = false;
static std::unique_ptr<airdcppd::Client> client;

static void installHandler();

static void uninit() {
	pidFile.reset(nullptr);
	if(!pidFileName.empty()) {
#ifdef _WIN32
		_unlink(pidFileName.c_str());
#else
		unlink(pidFileName.c_str());
#endif
	}
}

static void handleCrash(int sig) {
	if(crashed)
		abort();

	crashed = true;

	uninit();

	std::cerr << std::endl << std::endl;
	std::cerr << "Signal: " << std::to_string(sig) << std::endl;
#ifdef _WIN32
	std::cerr << "Process ID: " << GetCurrentProcessId() << std::endl;
#else
	std::cerr << "Process ID: " << getpid() << std::endl;
#endif
	std::cerr << "Time: " << Util::formatCurrentTime() << std::endl;
	std::cerr << "OS version: " << SystemUtil::getOsVersion() << std::endl;
	std::cerr << "Client version: " << shortVersionString << std::endl << std::endl;

#if USE_STACKTRACE
	std::cerr << "Collecting crash information, please wait..." << std::endl;
	cow::StackTrace trace(AppUtil::getAppPath());
	trace.generate_frames();
	std::copy(trace.begin(), trace.end(),
	std::ostream_iterator<cow::StackFrame>(std::cerr, "\n"));

	auto stackPath = AppUtil::getPath(AppUtil::PATH_USER_CONFIG) + "exceptioninfo.txt";
	std::ofstream f;
	f.open(stackPath.c_str());

	f << "Time: " + Util::formatCurrentTime() << std::endl;
	f << "OS version: " + SystemUtil::getOsVersion() << std::endl;
	f << "Client version: " + shortVersionString << std::endl << std::endl;

	std::copy(trace.begin(), trace.end(),
	std::ostream_iterator<cow::StackFrame>(f, "\n"));
	f.close();
	std::cout << "\nException info to be posted on the bug tracker has also been saved in " + stackPath << std::endl;
#else
	std::cout << std::endl;
	std::cout << "Stacktrace is not available" << std::endl;
#endif

	if (!asdaemon) {
		std::cout << std::endl;
		std::cout << "Press enter to exit" << std::endl;
		cin.ignore();
	}
	exit(sig);
}

void breakHandler(int) {
	if (client) {
		client->stop();
	}

	installHandler();
}

#ifdef _WIN32

static BOOL WINAPI consoleCtrlHandler(DWORD dwCtrlType) {
	switch (dwCtrlType) {
	case CTRL_C_EVENT:
	case CTRL_CLOSE_EVENT:
	case CTRL_BREAK_EVENT:
		if (client) {
			client->stop();
		}
		return TRUE;
	default:
		return FALSE;
	}
}

static void init() {
	SetConsoleCtrlHandler(consoleCtrlHandler, TRUE);
	installHandler();
}

static void installHandler() {
	signal(SIGINT, &breakHandler);
	signal(SIGTERM, &breakHandler);

#ifndef _DEBUG
	signal(SIGFPE, &handleCrash);
	signal(SIGSEGV, &handleCrash);
	signal(SIGILL, &handleCrash);

	std::set_terminate([] {
		handleCrash(0);
	});
#else
	std::cout << "Note: using debug build, crash handlers not installed" << std::endl;
#endif
}

#else // Unix

static void init() {
	struct sigaction sa = { 0 };
	sa.sa_handler = SIG_IGN;
	sigaction(SIGPIPE, &sa, NULL);
	sigaction(SIGHUP, &sa, NULL);

	sigset_t mask;
	sigfillset(&mask);
	sigdelset(&mask, SIGCONT);
	sigdelset(&mask, SIGFPE);
	sigdelset(&mask, SIGINT);
	sigdelset(&mask, SIGTRAP);

	installHandler();
}

static void installHandler() {
	signal(SIGINT, &breakHandler);
	signal(SIGTERM, &breakHandler);
	signal(SIGPIPE, SIG_IGN);

#ifndef _DEBUG
	signal(SIGBUS, &handleCrash);
	signal(SIGFPE, &handleCrash);
	signal(SIGSEGV, &handleCrash);
	signal(SIGILL, &handleCrash);

	std::set_terminate([] {
		handleCrash(0);
	});
#else
	std::cout << "Note: using debug build, crash handlers not installed" << std::endl;
#endif
}

#endif // _WIN32

static void setPidFilePath(const string& aConfigPath, const dcpp::StartupParams& aStartupParams) {
	auto pidParam = aStartupParams.getValue("-p");
	if (pidParam) {
		pidFileName = *pidParam;
	} else {
		pidFileName = aConfigPath + "airdcppd.pid";
	}
}

static void savePid(int aPid) noexcept {
	try {
		pidFile.reset(new File(pidFileName, File::WRITE, File::CREATE | File::OPEN | File::TRUNCATE));
		pidFile->write(Util::toString(aPid));
	} catch(const FileException& e) {
		fprintf(stderr, "Failed to create PID file %s: %s\n", pidFileName.c_str(), e.what());
		exit(1);
	}
}

#ifndef _WIN32

static void reportError(const char* aMessage) noexcept {
	fprintf(stderr, (string(aMessage) + ": %s\n").c_str(), strerror(errno));
}

static void daemonize(const dcpp::StartupParams& aStartupParams) noexcept {
	auto doFork = [&](const char* aErrorMessage) {
		auto ret = fork();

		switch(ret) {
		case -1:
			reportError(aErrorMessage);
			exit(5);
		case 0: break;
		default:
			savePid(ret);
			_exit(0);
		}
	};

	doFork("First fork failed");

	if(setsid() < 0) {
		reportError("setsid failed");
		exit(6);
	}

	doFork("Second fork failed");

	if (chdir("/") < 0) {
		reportError("chdir failed");
		exit(8);
	}

	close(0);
	close(1);
	close(2);
	open("/dev/null", O_RDWR);

	if (dup(0) < 0) {
		reportError("dup failed for stdout");
		exit(9);
	}

	if (dup(0) < 0) {
		reportError("dup failed for stderr");
		exit(10);
	}
}

static void runDaemon(const dcpp::StartupParams& aStartupParams) {
	daemonize(aStartupParams);

	try {
		client = unique_ptr<airdcppd::Client>(new airdcppd::Client(asdaemon));
		init();
		client->run(aStartupParams);
		client.reset();
	} catch(const std::exception& e) {
		fprintf(stderr, "Failed to start: %s\n", e.what());
	}

	uninit();
}

#endif // !_WIN32

static void runConsole(const dcpp::StartupParams& aStartupParams) {
	printf("Initializing."); fflush(stdout);

#ifdef _WIN32
	savePid(static_cast<int>(GetCurrentProcessId()));
#else
	savePid(static_cast<int>(getpid()));
#endif

	try {
		client = unique_ptr<airdcppd::Client>(new airdcppd::Client(asdaemon));
		printf("."); fflush(stdout);

		init();

		printf(".\n"); fflush(stdout);

		client->run(aStartupParams);

		client.reset();
	} catch(const std::exception& e) {
		fprintf(stderr, "\nFATAL: Can't start AirDC++ Web Client: %s\n", e.what());
	}
	uninit();
}

#define HELP_WIDTH 25
static void printUsage() {
	printf("Usage: airdcppd [options]\n");

	auto printHelp = [](const std::string& aCommand, const std::string& aHelp) {
		std::cout << std::left << std::setw(HELP_WIDTH) << std::setfill(' ') << aCommand;
		std::cout << std::left << std::setw(HELP_WIDTH) << std::setfill(' ') << aHelp << std::endl;
	};

	cout << std::endl;
	printHelp("-h", 								"Print help");
	printHelp("-v", 								"Print version");
#ifndef _WIN32
	printHelp("-d", 								"Run as daemon");
	printHelp("-p=PATH",							"Custom pid file path (default: <CFG_DIR>/.airdcppd.pid)");
#endif
	printHelp("-c=PATH", 						"Use the specified config directory for client settings");

	cout << std::endl;
	printHelp("--no-autoconnect", 	"Don't connect to any favorite hub on startup");
	printHelp("--cdm-hub", 					"Print all protocol communication with hubs in the console (debug)");
	printHelp("--cdm-client", 			"Print all protocol communication with other clients in the console (debug)");
	printHelp("--cdm-web", 					"Print web API commands and file requests in the console (debug)");

	cout << std::endl;
	cout << std::endl;
	cout << "Web server" << std::endl;
	cout << std::endl;
	printHelp("--configure", 					"Run initial config wizard or change server ports");
	printHelp("--add-user", 					"Add a new web user with administrative permissions (or change password for existing users)");
	printHelp("--remove-user", 				"Remove web user");
	printHelp("--web-resources=PATH", "Use the specified resource directory for web server files");
	cout << std::endl;
}

static void initAppPath(char* argv[]) {
#ifndef _WIN32
	char buf[PATH_MAX + 1] = { 0 };
	char* path = buf;
	if (readlink("/proc/self/exe", buf, sizeof (buf)) == -1) {
		path = getenv("_");
	}
	AppUtil::setApp(path == NULL ? argv[0] : path);
#endif
	// On Windows, AppUtil resolves the path via GetModuleFileName internally
}

int main(int argc, char* argv[]) {
#ifdef _WIN32
	SetConsoleOutputCP(CP_UTF8);
	SetConsoleCP(CP_UTF8);
#endif

	initAppPath(argv);

	dcpp::StartupParams startupParams;
	while (argc > 0) {
		startupParams.addParam(Text::toUtf8(*argv));
		argc--;
		argv++;
	}

	if (startupParams.hasParam("-h") || startupParams.hasParam("--help")) {
		printUsage();
		return 0;
	}

	if (startupParams.hasParam("-v") || startupParams.hasParam("--version")) {
		printf("%s\n", shortVersionString.c_str());
		return 0;
	}

	{
		auto customConfigDir = startupParams.getValue("-c");
		initializeUtil(customConfigDir ? AppUtil::formatCustomConfigPath(*customConfigDir) : "");
	}

	auto configF = airdcppd::ConfigPrompt::checkArgs(startupParams);
	if (configF) {
		init();
		signal(SIGINT, [](int) {
			airdcppd::ConfigPrompt::setPasswordMode(false);
			cout << std::endl;
			uninit();
			exit(0);
		});

		configF();

		uninit();
		return 0;
	}

#ifndef _WIN32
	if (startupParams.hasParam("-d")) {
		asdaemon = true;
	}
#endif

	setlocale(LC_ALL, "");

	string configPath = AppUtil::getPath(AppUtil::PATH_USER_CONFIG);
	setPidFilePath(configPath, startupParams);

#ifndef _WIN32
	if (asdaemon) {
		runDaemon(startupParams);
	} else
#endif
	{
		runConsole(startupParams);
	}

	return 0;
}
