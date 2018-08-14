#!/usr/bin/env node

const program = require('commander')
const pjson = require('./package.json')
const fs = require('fs-plus')
const loadJsonFile = require('load-json-file')
const changeCase = require('change-case')

/* 属性定义时,必须参考和遵循 https://realm.io/docs/swift/latest 的 Property cheatsheet 部分. */

// 目前,真正需要的,有以下几种类型: --- 此处在模拟 "枚举".
const propertyKinds = {
  BOOL: {
    NON_OPTIONAL: "bool-non-optional",
    OPTIONAL: "bool-optional",
  },
  INT: {
    NON_OPTIONAL: "int-non-optional",
    OPTIONAL: "int-optional",
  },
  FLOAT: {
    NON_OPTIONAL: "float-non-optional",
    OPTIONAL: "float-optional",
  },
  STRING: {
    NON_OPTIONAL: "string-non-optional",
    OPTIONAL: "string-optional",
  },
  OBJECT: {
    OPTIONAL: "object-optional",
  },
  LIST: {
    NON_OPTIONAL: "list-non-optional",
  },
  LINKINGOBJECTS: { // TODO: 需要尽快支持,通过配置文件来指定 LINKINGOBJECTS 属性,否则可能会导致无法分离 Realm 对象.
    NON_OPTIONAL: "linkingobjects-non-optional",
  }
}

// 解析必须的参数.
program
  .version(pjson.version)
  .option('-i, --input <path>', 'schema 源文件 所在目录')
  .option('-o, --output <path>', 'swift 文件 输出目录')
  .parse(process.argv)

// 获取所有 Schema 的路径.
const jsonFiles = fs.listSync(program.input, [".json"])

// 获取 Schema 中所有的 类型定义.
let types = []

jsonFiles.forEach((filepath)=>{
  let jsonObj = loadJsonFile.sync(filepath)

  const currentTypes = jsonObj["data"]["__schema"]["types"]
  
  types = types.concat(currentTypes)
})

// 去重.根据目前需要,仅保留 Enum 和 Object.
const supportTypeKinds = ["OBJECT"]
let typeNameDict = {}

types = types.filter((item)=>{
  if(!supportTypeKinds.includes(item.kind)){ // 不支持的数据类型.
    return false
  }

  const name = item.name

  if(name.startsWith("__") || name.toLowerCase() === "query"){ // 内置保留类型.
    return false
  }

  if(name.toLowerCase().includes("demo")){ // 说明是 Server 端测试数据.
    return false
  }

  if(typeNameDict[name]){ // 说明此类型已经记录.
    return false
  }

  typeNameDict[name] = true

  return true
}).sort((itemA, itemB) => {
  return itemA.name.toLowerCase().localeCompare(itemB.name.toLowerCase())
})

/* 生成一个 Swift 类.
* @item   一个 Schema 中的 Object 类型.
*
* @return 表示该类型的 Swift 字符串.
*/
function makeSwiftObjectClass(item){
  let rtn = 

`
//
//  ${item.name}.swift
//
//  注意: 该文件,自动从 Graphql 的 Schema 中生成,请勿直接修改此文件.
//
//  Created by graphswift on ${currentDate()}.
//

import Foundation
import RealmSwift
import ObjectMapper
import ObjectMapper_Realm

class ${item.name}: Object, Mappable {
    // MARK: 属性字段.
    ${item.fields.reduce((result, field)=>{
      return result + makeSwiftProperty(field)
    }, '')}
    ${makeMappingInfo(item.fields)}

    required convenience init?(map: Map) {
        self.init()
    }
    
    // MARK: primaryKey 请在 extention 中单独指定.
    // override class func primaryKey() -> String? {
    //     return "id"
    // }

    // MARK: 枚举转换, 扩展方法等,一定要以 extention 形式,写到单独文件中.枚举类型,直接用 Apollo 生成的全局 Enum 类型即可.
}
`

return rtn
}

/* 生成一个 Swift 属性.
* @field    一个 Schema field.
*
* @return   对应形式的 Swift 形式的 Property.
*/
function makeSwiftProperty(field) {
  let propertyInfo = whichKindProperty(field)

  switch (propertyInfo.kind){
    case propertyKinds.BOOL.NON_OPTIONAL: {
      let rtn = 
`
    /// ${propertyInfo.description}
    @objc dynamic var ${propertyInfo.name}: ${propertyInfo.type} = false
`
      return rtn
    }

    case propertyKinds.BOOL.OPTIONAL: {
      let rtn = 
`
    /// ${propertyInfo.description}
    let ${propertyInfo.name} = RealmOptional<${propertyInfo.type}>()
`
      return rtn
    }

    case propertyKinds.INT.NON_OPTIONAL: {
      let rtn = 
`
    /// ${propertyInfo.description}
    @objc dynamic var ${propertyInfo.name}: ${propertyInfo.type} = 0
`
      return rtn
    }

    case propertyKinds.INT.OPTIONAL: {
      let rtn = 
`
    /// ${propertyInfo.description}
    let ${propertyInfo.name} = RealmOptional<${propertyInfo.type}>()
`
      return rtn
    }

    case propertyKinds.FLOAT.NON_OPTIONAL: {
      let rtn = 
`
    /// ${propertyInfo.description}
    @objc dynamic var ${propertyInfo.name}: ${propertyInfo.type} = 0.0
`
      return rtn
    }

    case propertyKinds.FLOAT.OPTIONAL: {
      let rtn = 
`
    /// ${propertyInfo.description}
    let ${propertyInfo.name} = RealmOptional<${propertyInfo.type}>()
`
      return rtn
    }

    case propertyKinds.STRING.NON_OPTIONAL: {
      let rtn = 
`
    /// ${propertyInfo.description}
    @objc dynamic var ${propertyInfo.name} = ""
`
      return rtn
    }

    case propertyKinds.STRING.OPTIONAL: {
      let rtn = 
`
    /// ${propertyInfo.description}
    @objc dynamic var ${propertyInfo.name}: String? = nil
`
      return rtn
    }

    case propertyKinds.OBJECT.OPTIONAL: {
      let rtn = 
`
    /// ${propertyInfo.description}
    @objc dynamic var ${propertyInfo.name}: ${propertyInfo.type}? = 0.0
`
      return rtn
    }

    case propertyKinds.LIST.NON_OPTIONAL: {
      let rtn = 
`
    /// ${propertyInfo.description}
    let ${propertyInfo.name} = List<${propertyInfo.type}>()
`
      return rtn
    }

    default: {
      let rtn = 
`
    /// ${propertyInfo.description}
    @objc dynamic var ${propertyInfo.name}: ${propertyInfo.type}? = nil
`
    return rtn
    }
  }
}

/**
 * 获取 graphql 字段,对应的 swift 属性类型.
 * @param field   graphql 中某个 type 的字段信息. 
 * 
 * @return  完整形式是:{name: "owner", kind: propertyKinds.OBJECT.OPTIONAL, type: "User", description:"管理员"}
 */
function whichKindProperty(field){
  let name = field.name
  let description = field.description

  // 获取 List 中元素的类型.
  let elementTypeOfList = (typeInfo)=>{
     // "声明",不可为空的类型.
     switch (typeInfo.kind){
      case 'SCALAR': {
        switch (typeInfo.name){
          case 'Boolean': {
            const type = 'Bool'
            return type
          }

          case 'Int': {
            const type = 'Int'
            return type
          }
            
          case 'Float': {
            const type = 'Float'
            return type
          }
          default: {
            const type = 'String'
            return type
          }
        }
      }
      default: { // 说明是一个 Object 类型.
        const type = typeInfo.name
        return type
      }
    }
  }

  if(field.type.kind === 'NON_NULL'){ // "声明",不可为空的类型.
    const currentLevelTypeInfo = field.type.ofType
    switch (currentLevelTypeInfo.kind){
      case 'SCALAR': {
        switch (currentLevelTypeInfo.name){
          case 'Boolean': {
            const type = 'Bool'
            const kind = propertyKinds.BOOL.NON_OPTIONAL
            
            return {
              name,
              type,
              kind,
              description,
            }
          }

          case 'Int': {
            const type = 'Int'
            const kind = propertyKinds.INT.NON_OPTIONAL
            
            return {
              name,
              type,
              kind,
              description,
            }
          }
            
          case 'Float': {
            const type = 'Float'
            const kind = propertyKinds.FLOAT.NON_OPTIONAL
            
            return {
              name,
              type,
              kind,
              description,
            }
          }
          default: {
            const type = 'String'
            const kind = propertyKinds.STRING.NON_OPTIONAL
            
            return {
              name,
              type,
              kind,
              description,
            }
          }
        }
      }

      case 'LIST': {
        const type = elementTypeOfList(currentLevelTypeInfo.ofType)

        const kind = propertyKinds.LIST.NON_OPTIONAL
        
        return {
          name,
          type,
          kind,
          description,
        }
      }

      default: {
        const type = currentLevelTypeInfo.name

        const kind = propertyKinds.OBJECT.OPTIONAL
        
        return {
          name,
          type,
          kind,
          description,
        }
      }
    }
  } else { // "声明", 可为空的类型.
    const currentLevelTypeInfo = field.type

    switch (currentLevelTypeInfo.kind){
      case 'SCALAR': {
        switch (currentLevelTypeInfo.name){
          case 'Boolean': {
            const type = 'Bool'
            const kind = propertyKinds.BOOL.OPTIONAL
            
            return {
              name,
              type,
              kind,
              description,
            }
          }

          case 'Int': {
            const type = 'Int'
            const kind = propertyKinds.INT.OPTIONAL
            
            return {
              name,
              type,
              kind,
              description,
            }
          }
            
          case 'Float': {
            const type = 'Float'
            const kind = propertyKinds.FLOAT.OPTIONAL
            
            return {
              name,
              type,
              kind,
              description,
            }
          }
          default: {
            const type = 'String'
            const kind = propertyKinds.STRING.OPTIONAL
            
            return {
              name,
              type,
              kind,
              description,
            }
          }
        }
      }
      
      case 'LIST': {
        const type = elementTypeOfList(currentLevelTypeInfo.ofType)

        const kind = propertyKinds.LIST.NON_OPTIONAL
        
        return {
          name,
          type,
          kind,
          description,
        }
      }

      default: {
        const type = currentLevelTypeInfo.name

        const kind = propertyKinds.OBJECT.OPTIONAL
        
        return {
          name,
          type,
          kind,
          description,
        }
      }
    }
  }
}

/**
 * 当前时间.
 * 
 * @return 返回一个类似 2017/4/13 的当前时间.
 */
function currentDate(){
  const time = new Date()
  return `${time.getFullYear()}/${time.getMonth()+1}/${time.getDate()}`
}

/**
 * 生成 Mapping 信息.
 * @param fields graphql 的 type 的完整字段信息.
 */
function makeMappingInfo(fields) {
   let rtn = 
`   
    // MARK: - Mappable
        
    public func mapping(map: Map) {
        ${fields.reduce((result, field)=>{
          return result + 
          `
          ${changeCase.camelCase(field.name)} <- map["${field.name}"]
          `
        }, "")}
    }
`
return rtn
}

// TODO: 临时测试.
let testItem = types[0]
let x = makeSwiftObjectClass(testItem)
console.log(x)
// console.log(testItem.fields)