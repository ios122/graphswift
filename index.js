#!/usr/bin/env node

let program = require('commander')
let pjson = require('./package.json')

program
  .version(pjson.version)
  .option('-i, --input <path>', 'schema 源文件 所在目录')
  .option('-o, --output <path>', 'swift 文件 输出目录')
  .parse(process.argv)


  console.log(`输入目录: ${program.input}`)
  console.log(`输出目录: ${program.output}`)
