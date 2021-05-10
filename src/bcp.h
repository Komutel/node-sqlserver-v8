//---------------------------------------------------------------------------------------------------------------------------------
// File: bcp.h
// Contents: 
// 
// Copyright Microsoft Corporation and contributors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
//
// You may obtain a copy of the License at:
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//---------------------------------------------------------------------------------------------------------------------------------

#pragma once

#include <OdbcOperation.h>

namespace mssql
{
	using namespace std;
	using namespace v8;

	class OdbcConnection;
	class BoundDatum;
	class BoundDatumSet;
	class DatumStorage;
	class QueryOperationParams;
	class ConnectionHandles;
  
    struct plugin_bcp
    {
        ~plugin_bcp();
        #ifdef WINDOWS_BUILD
		bool load(const wstring &, shared_ptr<vector<shared_ptr<OdbcError>>> errors);
        HINSTANCE hinstLib = NULL;
        #endif
        inline RETCODE bcp_bind(HDBC, LPCBYTE, INT, DBINT, LPCBYTE, INT, INT, INT);
        inline RETCODE bcp_init(HDBC, LPCWSTR, LPCWSTR, LPCWSTR, INT); 
        inline DBINT bcp_sendrow(HDBC);
        inline DBINT bcp_done(HDBC);
        #ifdef LINUX_BUILD
        #define __cdecl 
        bool load(const string &, shared_ptr<vector<shared_ptr<OdbcError>>> errors, int m);
        void * hinstLib = NULL;
        #endif
        typedef RETCODE (__cdecl* plug_bcp_bind)(HDBC, LPCBYTE, INT, DBINT, LPCBYTE, INT, INT, INT);
        typedef RETCODE (__cdecl* plug_bcp_init)(HDBC, LPCWSTR, LPCWSTR, LPCWSTR, INT);
		typedef DBINT (__cdecl* plug_bcp_sendrow)(HDBC);
		typedef DBINT (__cdecl* plug_bcp_done)(HDBC);
        plug_bcp_bind dll_bcp_bind;
        plug_bcp_init dll_bcp_init;
		plug_bcp_sendrow dll_bcp_sendrow;
		plug_bcp_done dll_bcp_done;
    };

    struct basestorage {
        basestorage();
        virtual ~basestorage() {}
		virtual size_t size() = 0;
        virtual bool next() = 0;
        virtual LPCBYTE ptr() = 0;
        size_t index;
    };

	struct bcp 
	{
		bcp(const shared_ptr<BoundDatumSet> param_set, shared_ptr<OdbcConnectionHandle> h);
        int insert();
        bool init();
        bool bind();
        bool send();
        int done();
        wstring table_name();
        shared_ptr<OdbcConnectionHandle> _ch;
        shared_ptr<BoundDatumSet> _param_set;
        shared_ptr<vector<shared_ptr<OdbcError>>> _errors;
        vector<shared_ptr<basestorage>> _storage;
		plugin_bcp plugin;
	};
}

