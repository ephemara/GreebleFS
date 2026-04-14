import { buildTerminalCdCommand } from '../../src/components/terminalCommandUtils.ts';
console.log(buildTerminalCdCommand("C:\\Dev\\Taloor's Lab", 'pwsh.exe'));
console.log(buildTerminalCdCommand('C:\\Work\\OverlayTerm', 'cmd.exe'));
console.log(buildTerminalCdCommand("/home/taloor/overlay's", '/bin/bash'));
