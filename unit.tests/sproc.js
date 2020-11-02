'use strict'
/* global suite teardown teardown test setup */

const assert = require('assert')
const supp = require('../samples/typescript/demo-support')

suite('sproc', function () {
  let connStr
  let theConnection
  let support
  let driver
  let async
  let helper
  let procedureHelper
  const sql = global.native_sql

  this.timeout(20000)

  setup(testDone => {
    supp.GlobalConn.init(sql, co => {
      connStr = global.conn_str || co.conn_str
      support = co.support
      driver = co.driver
      var myRegexp = /Driver=\{(.*?)\}.*$/g
      var match = myRegexp.exec(connStr)
      driver = match[1]
      procedureHelper = new support.ProcedureHelper(connStr)
      procedureHelper.setVerbose(false)
      async = co.async
      helper = co.helper
      helper.setVerbose(false)
      sql.open(connStr, (err, conn) => {
        theConnection = conn
        assert(err === false)
        testDone()
      })
    }, global.conn_str)
  })

  teardown(done => {
    theConnection.close(err => {
      assert.ifError(err)
      done()
    })
  })

  test('optional parameters set output to 0', testDone => {
    const spName = 'test_sp_get_optional_p'

    const def = `alter PROCEDURE <name>(
      @plus INT out,
      @a INT,
      @b INT,
      @c INT = 0
    )
    AS begin
      SET XACT_ABORT ON;
      SET NOCOUNT ON;
      set @plus = @a + @b + @c;
    end;
`
    const fns = [
      asyncDone => {
        procedureHelper.createProcedure(spName, def, () => {
          asyncDone()
        })
      },

      asyncDone => {
        const pm = theConnection.procedureMgr()
        pm.get(spName, proc => {
          const count = pm.getCount()
          assert.strictEqual(count, 1)
          const o = {
            a: 2,
            b: 3,
            c: 4
          }
          proc.call(o, (err, results, output) => {
            assert.ifError(err)
            if (output) {
              assert(Array.isArray(output))
              const expected = [
                0,
                o.a + o.b + o.c
              ]
              assert.deepStrictEqual(expected, output)
              asyncDone()
            }
          })
        })
      }
    ]

    async.series(fns, () => {
      testDone()
    })
  })

  test('use input output parameters i.e. use a param as both input and output ', testDone => {
    const spName = 'test_sp_get_in_out_p'

    const def = `alter PROCEDURE <name> (
      @a INT,
      @plus INT out
    )
    AS begin
      SET XACT_ABORT ON;
      SET NOCOUNT ON;
      set @plus = @a + @plus;
    end;
`
    const fns = [
      asyncDone => {
        procedureHelper.createProcedure(spName, def, () => {
          asyncDone()
        })
      },

      asyncDone => {
        const pm = theConnection.procedureMgr()
        pm.get(spName, proc => {
          const count = pm.getCount()
          assert.strictEqual(count, 1)
          const o = {
            a: 2,
            plus: 3
          }
          proc.call(o, (err, results, output) => {
            assert.ifError(err)
            if (output) {
              assert(Array.isArray(output))
              const expected = [
                0,
                o.a + o.plus
              ]
              assert.deepStrictEqual(expected, output)
              asyncDone()
            }
          })
        })
      }
    ]

    async.series(fns, () => {
      testDone()
    })
  })

  test('two in out params use first as input only second output only', testDone => {
    const spName = 'test_sp_get_in_out_p'

    const def = `alter PROCEDURE <name> (
      @a INT,
      @plus_in INT out,
      @plus_out INT out
    )
    AS begin
      SET XACT_ABORT ON;
      SET NOCOUNT ON;
      set @plus_out = @a + @plus_in;
    end;
`
    const fns = [
      asyncDone => {
        procedureHelper.createProcedure(spName, def, () => {
          asyncDone()
        })
      },

      asyncDone => {
        const pm = theConnection.procedureMgr()
        pm.get(spName, proc => {
          const count = pm.getCount()
          assert.strictEqual(count, 1)
          const o = {
            a: 2,
            plus_in: 3
          }
          proc.call(o, (err, results, output) => {
            assert.ifError(err)
            if (output) {
              assert(Array.isArray(output))
              const expected = [
                0,
                o.plus_in,
                o.a + o.plus_in
              ]
              assert.deepStrictEqual(expected, output)
              asyncDone()
            }
          })
        })
      }
    ]

    async.series(fns, () => {
      testDone()
    })
  })

  test('test non existant sproc', testDone => {
    const spName = 'test_sp_i_do_not_exist'

    const fns = [

      asyncDone => {
        const pm = theConnection.procedureMgr()
        pm.get(spName, proc => {
          const count = pm.getCount()
          assert.strictEqual(count, 1)
          proc.call([1, 'NI123456', 'Programmer01'], (err, results, output) => {
            assert(err)
            asyncDone()
          })
        })
      }
    ]

    async.series(fns, () => {
      testDone()
    })
  })

  test('get proc and call multiple times asynchronously with changing params i.e. prove each call is independent', testDone => {
    const spName = 'test_sp_get_int_int'

    const def = `alter PROCEDURE <name> (
@num1 INT,
@num2 INT,
@num3 INT OUTPUT

)AS
BEGIN
   SET @num3 = @num1 + @num2
   RETURN 99;
END
`

    const fns = [
      asyncDone => {
        procedureHelper.createProcedure(spName, def, () => {
          asyncDone()
        })
      },

      asyncDone => {
        const pm = theConnection.procedureMgr()
        pm.get(spName, procedure => {
          const count = pm.getCount()
          assert.strictEqual(count, 1)
          const received = []
          const iterations = 500

          const check = () => {
            for (let i = 0; i < iterations; ++i) {
              const expected = [99, i * 2]
              assert.deepStrictEqual(received[i], expected, 'results didn\'t match')
            }
            asyncDone()
          }

          for (let i = 0; i < iterations; ++i) {
            procedure.call([i, i], (err, results, output) => {
              assert.ifError(err)
              received[received.length] = output
              if (received.length === iterations) {
                check()
              }
            })
          }
        })
      }
    ]

    async.series(fns, () => {
      testDone()
    })
  })

  test('test sproc with insert, update and delete', testDone => {
    const spName = 'test_sp_multi_statement'

    const def = `alter PROCEDURE <name>(
@p1 INT,
@p2 nvarchar(15),
@p3 nvarchar(256)

)AS
BEGIN
    insert into TestMultiStatement (BusinessEntityID, NationalIDNumber, LoginID) values (@p1, @p2, @p3)
    
    update TestMultiStatement set BusinessEntityID = 100 where BusinessEntityID = @p1
    
    delete from TestMultiStatement where BusinessEntityID = 100 
END
`
    const fns = [
      asyncDone => {
        theConnection.queryRaw('DROP TABLE TestMultiStatement', () => {
          asyncDone()
        })
      },

      asyncDone => {
        theConnection.queryRaw(`CREATE TABLE TestMultiStatement (
          [BusinessEntityID] [int] NOT NULL,
          [NationalIDNumber] [nvarchar](15) NOT NULL,
          [LoginID] [nvarchar](256) NOT NULL,
          )`,
        e => {
          assert.ifError(e)
          asyncDone()
        })
      },

      asyncDone => {
        procedureHelper.createProcedure(spName, def, () => {
          asyncDone()
        })
      },

      asyncDone => {
        const pm = theConnection.procedureMgr()
        pm.get(spName, proc => {
          const count = pm.getCount()
          assert.strictEqual(count, 1)
          proc.call([1, 'NI123456', 'Programmer01'], (err, results, output, more) => {
            assert.ifError(err)
            if (!output) return
            asyncDone()
          })
        })
      }
    ]

    async.series(fns, () => {
      testDone()
    })
  })

  test('get proc and call multiple times synchronously with changing params i.e. prove each call is independent', testDone => {
    const spName = 'test_sp_get_int_int'

    const def = `alter PROCEDURE <name>(
@num1 INT,
@num2 INT,
@num3 INT OUTPUT

)AS
BEGIN
   SET @num3 = @num1 + @num2
   RETURN 99;
END
`

    const fns = [
      asyncDone => {
        procedureHelper.createProcedure(spName, def, () => {
          asyncDone()
        })
      },

      asyncDone => {
        const pm = theConnection.procedureMgr()
        pm.get(spName, proc => {
          const count = pm.getCount()
          assert.strictEqual(count, 1)
          let i
          const received = []
          const iterations = 10

          const check = () => {
            for (i = 0; i < iterations; ++i) {
              const expected = [99, i * 2]
              assert.deepStrictEqual(received[i], expected, 'results didn\'t match')
            }
            asyncDone()
          }

          function next (i) {
            proc.call([i, i], (err, results, output) => {
              assert.ifError(err)
              received[received.length] = output
              if (received.length === iterations) {
                check()
              } else {
                next(i + 1)
              }
            })
          }

          next(0)
        })
      }
    ]

    async.series(fns, () => {
      testDone()
    })
  })

  test('proc with multiple select  - should callback with each', testDone => {
    const spName = 'test_sp_select_select'

    const def = `alter PROCEDURE <name>(
@num1 INT,
@num2 INT,
@num3 INT OUTPUT

)AS
BEGIN
BEGIN
    select top 5 'syscolumns' as table_name, name, id, xtype, length from syscolumns
    select top 5 'sysobjects' as table_name, name, id, xtype, category from sysobjects
END
END
`

    const fns = [
      asyncDone => {
        procedureHelper.createProcedure(spName, def, () => {
          asyncDone()
        })
      },

      asyncDone => {
        const pm = theConnection.procedureMgr()
        pm.get(spName, proc => {
          const count = pm.getCount()
          assert.strictEqual(count, 1)
          const aggregate = []
          const reducer = (arr) => {
            return arr.reduce((t, latest) => {
              t.push(latest.table_name)
              return t
            }, [])
          }
          proc.call([], (err, results, output) => {
            assert.ifError(err)
            aggregate.push(results)
            if (output) {
              assert.strictEqual(2, aggregate.length, 'results didn\'t match')
              assert.strictEqual(true, Array.isArray(aggregate[0]))
              assert.strictEqual(true, Array.isArray(aggregate[1]))
              const tableNames0 = reducer(aggregate[0])
              tableNames0.forEach(s => {
                assert.strictEqual('syscolumns', s)
              })
              const tableNames1 = reducer(aggregate[1])
              tableNames1.forEach(s => {
                assert.strictEqual('sysobjects', s)
              })
              asyncDone()
            }
          })
        })
      }
    ]

    async.series(fns, () => {
      testDone()
    })
  })

  test('check proc called as object paramater where converting via utility method', testDone => {
    const spName = 'test_sp_select_select'

    const def = `alter PROCEDURE <name>(
@num1 INT,
@num2 INT,
@num3 INT OUTPUT

)AS
BEGIN
   SET @num3 = @num1 + @num2
   RETURN 99;
END
`

    const fns = [
      asyncDone => {
        procedureHelper.createProcedure(spName, def, () => {
          asyncDone()
        })
      },

      asyncDone => {
        const pm = theConnection.procedureMgr()
        pm.get(spName, proc => {
          const count = pm.getCount()
          assert.strictEqual(count, 1)
          const o = {
            num1: 10,
            num2: 100
          }
          const p = proc.paramsArray(o)
          proc.call(p, (err, results, output) => {
            assert.ifError(err)
            if (output) {
              assert(Array.isArray(output))
              const expected = [
                99,
                o.num1 + o.num2
              ]
              assert.deepStrictEqual(expected, output)
              asyncDone()
            }
          })
        })
      }
    ]

    async.series(fns, () => {
      testDone()
    })
  })

  test('check proc called as object paramater where vals sent as attributes', testDone => {
    const spName = 'test_sp_select_select'

    const def = `alter PROCEDURE <name>(
@num1 INT,
@num2 INT,
@num3 INT OUTPUT

)AS
BEGIN
   SET @num3 = @num1 + @num2
   RETURN 99;
END
`

    const fns = [
      asyncDone => {
        procedureHelper.createProcedure(spName, def, () => {
          asyncDone()
        })
      },

      asyncDone => {
        const pm = theConnection.procedureMgr()
        pm.get(spName, proc => {
          const count = pm.getCount()
          assert.strictEqual(count, 1)
          const o = {
            num1: 10,
            num2: 100
          }
          proc.call(o, (err, results, output) => {
            assert.ifError(err)
            if (output) {
              assert(Array.isArray(output))
              const expected = [
                99,
                o.num1 + o.num2
              ]
              assert.deepStrictEqual(expected, output)
              asyncDone()
            }
          })
        })
      }
    ]

    async.series(fns, () => {
      testDone()
    })
  })

  test('stream call proc no callback with print in proc', testDone => {
    const spName = 'test_len_of_sp'

    const def = `alter PROCEDURE <name> @param VARCHAR(50) 
 AS 
 BEGIN 
     raiserror('a print in proc message',0,0) with nowait;
     select LEN(@param) as len; 
 END 
`

    const fns = [
      asyncDone => {
        procedureHelper.createProcedure(spName, def, () => {
          asyncDone()
        })
      },

      asyncDone => {
        const pm = theConnection.procedureMgr()
        const rows = []
        let info = null
        let submitted = false
        pm.get(spName, proc => {
          const qp = proc.call(['javascript'])
          qp.on('column', (c, data) => {
            const l = c.toString()
            const r = {}
            r[l] = data
            rows.push(r)
          })

          qp.on('free', () => {
            // console.log('done ....')
            assert(rows.length === 1)
            assert.strictEqual(true, submitted)
            assert(info.includes('a print in proc message'))
            const expected = [
              {
                0: 10
              }
            ]
            assert.deepStrictEqual(expected, rows)
            asyncDone()
          })

          qp.on('error', (e) => {
            assert.ifError(e)
          })

          qp.on('submitted', (q) => {
            // console.log('submitted')
            submitted = true
          })

          qp.on('info', (i) => {
            // console.log(`info ${i}`)
            info = i.message
          })
        })
      }
    ]

    async.series(fns, () => {
      testDone()
    })
  })

  test('call proc that has 2 output string params + return code', testDone => {
    const spName = 'test_sp_get_str_str'

    const def = `alter PROCEDURE <name>(
@id INT,
@name varchar(20) OUTPUT,
@company varchar(20) OUTPUT

)AS
BEGIN
   SET @name = 'name'
   SET @company = 'company'
   RETURN 99;
END
`

    const fns = [
      asyncDone => {
        procedureHelper.createProcedure(spName, def, () => {
          asyncDone()
        })
      },

      asyncDone => {
        const pm = theConnection.procedureMgr()
        pm.callproc(spName, [1], (err, results, output) => {
          assert.ifError(err)
          const expected = [99, 'name', 'company']
          assert.deepStrictEqual(output, expected, 'results didn\'t match')
          asyncDone()
        })
      }
    ]

    async.series(fns, () => {
      testDone()
    })
  })

  test('get proc and call  - should not error', testDone => {
    const spName = 'test_sp_get_int_int'

    const def = `alter PROCEDURE <name>(
@num1 INT,
@num2 INT,
@num3 INT OUTPUT

)AS
BEGIN
   SET @num3 = @num1 + @num2
   RETURN 99;
END
`

    const fns = [
      asyncDone => {
        procedureHelper.createProcedure(spName, def, () => {
          asyncDone()
        })
      },

      asyncDone => {
        const pm = theConnection.procedureMgr()
        pm.get(spName, proc => {
          const count = pm.getCount()
          assert.strictEqual(count, 1)
          proc.call([10, 5], (err, results, output) => {
            const expected = [99, 15]
            assert.ifError(err)
            assert.deepStrictEqual(output, expected, 'results didn\'t match')
            asyncDone()
          })
        })
      }
    ]

    async.series(fns, () => {
      testDone()
    })
  })

  test('stream call proc no callback', testDone => {
    const spName = 'test_len_of_sp'

    const def = `alter PROCEDURE <name> @param VARCHAR(50) 
 AS 
 BEGIN 
     select LEN(@param) as len; 
 END 
`

    const fns = [
      asyncDone => {
        procedureHelper.createProcedure(spName, def, () => {
          asyncDone()
        })
      },

      asyncDone => {
        const pm = theConnection.procedureMgr()
        const rows = []
        pm.get(spName, proc => {
          const qp = proc.call(['javascript'])
          qp.on('column', (c, data) => {
            const l = c.toString()
            const r = {}
            r[l] = data
            rows.push(r)
          })

          qp.on('free', () => {
            assert(rows.length === 1)
            const expected = [
              {
                0: 10
              }
            ]
            assert.deepStrictEqual(expected, rows)
            asyncDone()
          })
        })
      }
    ]

    async.series(fns, () => {
      testDone()
    })
  })

  const waitProcDef = `alter PROCEDURE <name>(
@timeout datetime
)AS
BEGIN
waitfor delay @timeout;END
`

  test('call proc that waits for delay of input param - wait 2, timeout 5 - should not error', testDone => {
    const spName = 'test_spwait_for'

    const fns = [
      asyncDone => {
        procedureHelper.createProcedure(spName, waitProcDef, () => {
          asyncDone()
        })
      },

      asyncDone => {
        const pm = theConnection.procedureMgr()
        pm.setTimeout(5)
        pm.callproc(spName, ['0:0:2'], err => {
          assert.ifError(err)
          asyncDone()
        })
      }
    ]

    async.series(fns, () => {
      testDone()
    })
  })

  test('call proc that waits for delay of input param - wait 5, timeout 2 - should error', testDone => {
    const spName = 'test_spwait_for'

    const fns = [
      asyncDone => {
        procedureHelper.createProcedure(spName, waitProcDef, () => {
          asyncDone()
        })
      },

      asyncDone => {
        const expected = new Error(`[Microsoft][${driver}]Query timeout expired`)
        expected.sqlstate = 'HYT00'
        expected.code = 0
        const pm = theConnection.procedureMgr()
        pm.setTimeout(2)
        pm.callproc(spName, ['0:0:5'], err => {
          assert.deepStrictEqual(err, expected)
          asyncDone()
        })
      }
    ]

    async.series(fns, () => {
      testDone()
    })
  })

  test('call proc error with timeout then query on same connection', testDone => {
    const spName = 'test_spwait_for'

    const fns = [
      asyncDone => {
        procedureHelper.createProcedure(spName, waitProcDef, () => {
          asyncDone()
        })
      },

      asyncDone => {
        const expected = new Error(`[Microsoft][${driver}]Query timeout expired`)
        expected.sqlstate = 'HYT00'
        expected.code = 0
        const pm = theConnection.procedureMgr()
        pm.setTimeout(2)
        pm.callproc(spName, ['0:0:5'], err => {
          assert.deepStrictEqual(err, expected)
          asyncDone()
        })
      },

      asyncDone => {
        const expected = [
          {
            n: 1
          }]
        sql.query(connStr, 'SELECT 1 as n', (err, res) => {
          assert.ifError(err)
          assert.deepStrictEqual(expected, res)
          asyncDone()
        })
      }
    ]

    async.series(fns, () => {
      testDone()
    })
  })

  test('call proc that returns length of input string and decribes itself in results', testDone => {
    const spName = 'test_sp'

    const def = `alter PROCEDURE <name> @param VARCHAR(50) 
 AS 
 BEGIN 
     SELECT name, type, type_desc  FROM sys.objects WHERE type = 'P' AND name = '<name>'     RETURN LEN(@param); 
 END 
`

    const fns = [
      asyncDone => {
        procedureHelper.createProcedure(spName, def, () => {
          asyncDone()
        })
      },

      asyncDone => {
        const pm = theConnection.procedureMgr()
        pm.callproc(spName, ['US of A!'], (err, results, output) => {
          assert.ifError(err)
          let expected = [8]
          assert.deepStrictEqual(output, expected, 'results didn\'t match')
          expected = [
            {
              name: spName,
              type: 'P ',
              type_desc: 'SQL_STORED_PROCEDURE'
            }]
          assert.deepStrictEqual(results, expected, 'results didn\'t match')
          asyncDone()
        })
      }
    ]

    async.series(fns, () => {
      testDone()
    })
  })

  test('call proc that returns length of input string', testDone => {
    const spName = 'test_sp'

    const def = `alter PROCEDURE <name> @param VARCHAR(50) 
 AS 
 BEGIN 
     RETURN LEN(@param); 
 END 
`

    const fns = [
      asyncDone => {
        procedureHelper.createProcedure(spName, def, () => {
          asyncDone()
        })
      },

      asyncDone => {
        const pm = theConnection.procedureMgr()
        pm.get(spName, proc => {
          proc.call(['US of A!'], (err, results, output) => {
            assert.ifError(err)
            const expected = [8]
            assert.deepStrictEqual(output, expected, 'results didn\'t match')
            asyncDone()
          })
        })
      }
    ]

    async.series(fns, () => {
      testDone()
    })
  })

  test('call proc that has 2 input params + 1 output', testDone => {
    const spName = 'test_sp_get_int_int'

    const def = `alter PROCEDURE <name>(
@num1 INT,
@num2 INT,
@num3 INT OUTPUT

)AS
BEGIN
   SET @num3 = @num1 + @num2
   RETURN 99;
END
`

    const fns = [
      asyncDone => {
        procedureHelper.createProcedure(spName, def, () => {
          asyncDone()
        })
      },

      asyncDone => {
        const pm = theConnection.procedureMgr()
        pm.callproc(spName, [10, 5], (err, results, output) => {
          assert.ifError(err)
          const expected = [99, 15]
          assert.deepStrictEqual(output, expected, 'results didn\'t match')
          asyncDone()
        })
      }
    ]

    async.series(fns, () => {
      testDone()
    })
  })

  test('test asselect on proc', testDone => {
    const spName = 'test_sp_get_int_int'

    const def = `alter PROCEDURE <name>(
@num1 INT,
@num2 INT,
@num3 INT OUTPUT

)AS
BEGIN
   SET @num3 = @num1 + @num2
   RETURN 99;
END
`

    const fns = [
      asyncDone => {
        procedureHelper.createProcedure(spName, def, () => {
          asyncDone()
        })
      },

      asyncDone => {
        const pm = theConnection.procedureMgr()
        pm.get(spName, proc => {
          const meta = proc.getMeta()
          // use an mssql style select
          const s = meta.select
          theConnection.query(s, [10, 5], (err, results) => {
            assert.ifError(err)
            const expected = [{
              num3: 15,
              ___return___: 99
            }]
            assert.deepStrictEqual(results, expected, 'results didn\'t match')
            asyncDone()
          })
        })
      }
    ]

    async.series(fns, () => {
      testDone()
    })
  })

  test('call proc in non-dbo schema with parameters using callproc syntax', testDone => {
    const spName = 'TestSchema.test_sp_get_int_int'

    const schemaName = 'TestSchema'
    const createSchemaSql = `IF NOT EXISTS (
    SELECT schema_name
    FROM  information_schema.schemata
    WHERE schema_name = '${schemaName}')
    BEGIN
    EXEC sp_executesql N'CREATE SCHEMA ${schemaName}'
    END`

    const def = `alter PROCEDURE <name>(
@num1 INT,
@num2 INT,
@num3 INT OUTPUT

)AS
BEGIN
   SET @num3 = @num1 + @num2
   RETURN 99;
END
`

    const fns = [

      asyncDone => {
        theConnection.query(createSchemaSql, err => {
          assert.ifError(err)
          asyncDone()
        })
      },

      asyncDone => {
        procedureHelper.createProcedure(spName, def, () => {
          asyncDone()
        })
      },

      asyncDone => {
        const pm = theConnection.procedureMgr()
        pm.callproc(spName, [20, 8], function (err, results, output) {
          assert.ifError(err)
          const expected = [99, 28]
          assert.ok(expected[0] === output[0], "results didn't match")
          assert.ok(expected[1] === output[1], "results didn't match")
          asyncDone()
        })
      }
    ]

    async.series(fns, () => {
      testDone()
    })
  })
})
