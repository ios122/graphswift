#!/usr/bin/env node

const program = require('commander')
const pjson = require('./package.json')
const fs = require('fs-plus')
const loadJsonFile = require('load-json-file')
const changeCase = require('change-case')

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
//  Luka
//
//  注意: 该文件,自动从 Graphql 的 Schema 中生成,请勿直接修改此文件.
//
//  Created by Luka研发 on ${currentDate()}.
//  Copyright © 2017年 北京物灵智能科技有限公司. All rights reserved.
//

import Foundation
import RealmSwift
import ObjectMapper
import ObjectMapper_Realm

class ${item.name}: Object, Mappable {
    // MARK: 属性字段.
    ${item.fields.reduce((result, filed)=>{
      return result + makeSwiftProperty(filed)
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
// TODO: 不同 kind,需要不同的模板

  let rtn = 
`
    /// ${field.description}
    @objc dynamic var ${field.name}: ${field.type.name} = ""
`

  return rtn
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
`   // MARK: - Mappable
        
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
console.log(testItem.name)
let x = makeSwiftObjectClass(testItem)
console.log(x)
// console.log(testItem.fields)