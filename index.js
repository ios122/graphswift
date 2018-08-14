#!/usr/bin/env node

const program = require('commander')
const pjson = require('./package.json')
const fs = require('fs-plus')
const loadJsonFile = require('load-json-file')

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
const supportTypeKinds = ["OBJECT", "ENUM"]
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
