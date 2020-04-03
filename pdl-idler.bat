@echo off
del _pdl-idler.js
type D:\Work\node-pdl-idler\pdl-idler_common.js D:\Work\node-pdl-idler\pdl-idler_ugc.js D:\Work\node-pdl-idler\pdl-idler_trade.js D:\Work\node-pdl-idler\pdl-idler_tf2.js D:\Work\node-pdl-idler\pdl-idler_profile.js D:\Work\node-pdl-idler\pdl-idler_group.js D:\Work\node-pdl-idler\pdl-idler_game.js D:\Work\node-pdl-idler\pdl-idler_store.js D:\Work\node-pdl-idler\pdl-idler_friend.js D:\Work\node-pdl-idler\pdl-idler.js D:\Work\node-pdl-idler\README.md> _pdl-idler.js
node --max-old-space-size=8192 _pdl-idler.js %*
