"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBanner = exports.getWelcomeScreen = void 0;
const chalk_1 = __importDefault(require("chalk"));
const getWelcomeScreen = () => {
    return chalk_1.default.cyan(`
╔═════════════════════════════════════════════════════════════════════════════════════╗
║                                                                                     ║
║  ██████╗ ██╗      █████╗ ██╗   ██╗██╗    ██╗██████╗ ██╗ ██████╗ ██╗  ██╗████████╗   ║
║  ██╔══██╗██║     ██╔══██╗╚██╗ ██╔╝██║    ██║██╔══██╗██║██╔════╝ ██║  ██║╚══██╔══╝   ║
║  ██████╔╝██║     ███████║ ╚████╔╝ ██║ █╗ ██║██████╔╝██║██║  ███╗███████║   ██║      ║
║  ██╔═══╝ ██║     ██╔══██║  ╚██╔╝  ██║███╗██║██╔══██╗██║██║   ██║██╔══██║   ██║      ║
║  ██║     ███████╗██║  ██║   ██║   ╚███╔███╔╝██║  ██║██║╚██████╔╝██║  ██║   ██║      ║
║  ╚═╝     ╚══════╝╚═╝  ╚═╝   ╚═╝    ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝      ║
║                                                                                     ║
║  ███████╗██╗████████╗███████╗    ███████╗ ██████╗ █████╗ ███╗   ██╗                 ║
║  ██╔════╝██║╚══██╔══╝██╔════╝    ██╔════╝██╔════╝██╔══██╗████╗  ██║                 ║
║  ███████╗██║   ██║   █████╗      ███████╗██║     ███████║██╔██╗ ██║                 ║
║  ╚════██║██║   ██║   ██╔══╝      ╚════██║██║     ██╔══██║██║╚██╗██║                 ║
║  ███████║██║   ██║   ███████╗    ███████║╚██████╗██║  ██║██║ ╚████║                 ║
║  ╚══════╝╚═╝   ╚═╝   ╚══════╝    ╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═══╝                 ║
║                                                                                     ║
╚═════════════════════════════════════════════════════════════════════════════════════╝
`);
};
exports.getWelcomeScreen = getWelcomeScreen;
const getBanner = () => {
    return chalk_1.default.cyan(`
🚀 Welcome to Playwright Site Scanner!
   Your automated website testing companion
`);
};
exports.getBanner = getBanner;
//# sourceMappingURL=ascii-art.js.map