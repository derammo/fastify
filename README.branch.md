This is an experiment using 
https://marketplace.visualstudio.com/items?itemName=jvcdk-at-github.vscode-commandline-test-adapter
to try to show the tap tests for fastify in the VSCode UI

It is an unsupported play project.

To use:

- use the extension to re-scan the tap info (I think I set the folder watch correctly, 
  but maybe not) via the extension's command

- it will run all tests and pipe the output into the reporter module that builds the 
  test UI

- look in the tests bar on the left (looks like a lab flask)
