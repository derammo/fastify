const fsp = require('fs/promises')
const fs = require('fs')
const process = require('process')
const path = require('path')
const stream = require('stream')

const testMatch = /^# Subtest: test\/(.*)\.test\.js$/
const subtestMatch = /^( +)# Subtest: (.*)$/
const subtestCodeMatch = /test\(['"]([^'"]+)['"], /

const results = []

function escapeRegex(string) {
  return string.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&')
}

let stack
let lineIndex

async function processMainTestLine(match) {
  if (stack) {
    results.push(stack[0].test)
  }
  const sourceFile = `test/${match[1]}.test.js`
  stack = [{
    test: {
      label: match[1],
      command: 'node',
      args: ['node_modules/tap/bin/run.js', sourceFile],
      file: sourceFile,
      line: 1,
      children: []
    },
    indent: 0,
    name: 'unused'
  }]
  lineIndex = {}

  // index the test source to locate subtests by name
  const sourceCode = await read(fs.createReadStream(sourceFile))
  if (!sourceCode) {
    throw new Error(`failed to read source code from '${sourceFile}'`)
  }
  const sourceLines = sourceCode.split('\n')
  let lineNumber = 1
  for (const code of sourceLines) {
    const subtestCode = subtestCodeMatch.exec(code)
    if (subtestCode) {
      lineIndex[subtestCode[1]] = lineNumber
    }
    lineNumber++
  }
}

async function processSubtestLine(match) {
  const indent = match[1].length
  while (indent <= stack.at(-1).indent) {
    stack.pop();
  }

  const nameSegments = Array.from(stack.map((test) => test.name))
  nameSegments.shift()
  nameSegments.push(match[2])
  const name = nameSegments.join(' ')
  const subtest = {
    label: name,
    command: 'node',
    args: ['node_modules/tap/bin/run.js', stack[0].test.file],
    file: stack[0].test.file,
    // XX note this won't work with multiple subtests of the same name, would need an array per name to shift from
    line: lineIndex[match[2]] || 1,
    children: []
  }
  for (const segment of nameSegments) {
    subtest.args.push('-g')
    subtest.args.push(segment)
  }
  stack.at(-1).test.children.push(subtest)
  stack.push({ test: subtest, indent: indent, name: match[2] })
}

async function translateTests(fullText) {
  const tapLines = fullText.split('\n')
  for (tapLine of tapLines) {
    const test = testMatch.exec(tapLine)
    if (test) {
      await processMainTestLine(test)
      continue
    }
    const subtest = subtestMatch.exec(tapLine)
    if (subtest) {
      await processSubtestLine(subtest)
      continue
    }
  }
}

async function read(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

class Translator extends stream.Writable {
  constructor() {
    super()
    this.chunks = []
  }

  _write(chunk, enc, next) {
    this.chunks.push(chunk)
    next()
  }

  _final(done) {
    const fullText = Buffer.concat(this.chunks).toString('utf8')
    translateTests(fullText).then(() => {
      if (stack) {
        results.push(stack[0].test)
      }
      console.log(JSON.stringify(results, undefined, 2))
      done()
    })
  }
}

module.exports = Translator