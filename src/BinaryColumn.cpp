//---------------------------------------------------------------------------------------------------------------------------------
// File: Column.cpp
// Contents: Column objects from SQL Server to return as Javascript types
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

#include "stdafx.h"
#include <BinaryColumn.h>

namespace mssql {

	BinaryColumn::BinaryColumn(const int id, shared_ptr<DatumStorage> s, const size_t l) : Column(id)
	                                                                                       , storage(s->charvec_ptr), len(l), offset(0)
	{
	}

	BinaryColumn::BinaryColumn(const int id, shared_ptr<DatumStorage> s, const size_t offset, const size_t l) : Column(id)                                                                                             , storage(s->charvec_ptr), len(l), offset(offset)
	{
	}
	
	static void delete_buffer(char* ptr, void* hint)
	{
		//auto* bc = static_cast<BinaryColumn*>(hint);
		// fprintf(stderr, "delete ptr %p\n", hint);
		// fprintf(stderr, "delete_buffer %p\n", ptr);
		// delete[] ptr;
	}
	
	Local<Value> BinaryColumn::ToValue()
	{
		const auto ptr = storage->data() + offset;
		char *str = new char[len];
		memcpy(str, ptr, len);
		// fprintf(stderr, "[%d], ToValue len = %zu, offset = %zu, ptr = %p, destructed = %d\n", Id(), len, offset, str, destructed);
		const auto buff = node::Buffer::New(Isolate::GetCurrent(), str, len, delete_buffer, nullptr)
		// const auto buff = node::Buffer::New(Isolate::GetCurrent(), str, len)
#ifdef NODE_GYP_V4 
			.ToLocalChecked()
#endif
			;
		return buff;
	}
}   // namespace mssql