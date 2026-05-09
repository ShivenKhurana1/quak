#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from './App.js';
import { Storage } from './storage.js';
import { SetupWizard } from './components/SetupWizard.js';

async function main() {
  const storage = new Storage();
  const isFirstRun = !storage.exists();

  if (isFirstRun) {
    render(React.createElement(SetupWizard, { storage }));
  } else {
    render(React.createElement(App, { storage }));
  }
}

main().catch(console.error);