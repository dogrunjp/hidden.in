var config={hostname:"test.example.com"};chrome.runtime.onConnect.addListener(function(e){e.onMessage.addListener(function(t){"getStreamId"==t&&chrome.desktopCapture.chooseDesktopMedia(["screen","window"],e.sender.tab,function(t){console.log(t),e.postMessage({streamid:t})})})});var injectContentScriptToExistingTabs=function(){chrome.tabs.query({status:"complete",url:"*://"+config.hostname+"/*"},function(e){console.dir(e),e.forEach(function(e){console.log(e),chrome.tabs.executeScript(e.id,{file:"content.js",runAt:"document_start"}),console.log("content.js executed")})})};injectContentScriptToExistingTabs();