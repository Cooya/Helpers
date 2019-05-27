# Helpers
Utility NPM packages helping me to code faster in NodeJS


### Utils - API
-   async function readXMLFile(filePath)
-   async function writeXMLFile(filePath, content)
-   async function downloadFile(url, destFolder, fileName = null, forceDownload = false)
-   async function fileExists(filePath)
-   async function fileSize(filePath)
-   async function deleteFile(filePath)
-   function getRandomNumber(min, max)
-   async function randomSleep(min, max)
-   function resolveUrl(base, url)
-   function getLinks(\$, selector)
-   async function waitForValue(variable, expectedValue, delay = 500, iterations = 10)
-   async function attempt(action, attemptsNumber = 3)
-   async function asyncForEach(array, callback, maxSimultaneous = 0)
-   async function asyncThreads(array, callback, threadsNumber = 10)
-   async function request(method, url, options = {})
-   async function get(url, options = {})
-   async function post(url, options = {})
-   function Array.prototype.equalsTo(arr)
-   function Array.prototype.getItemWithKey(key, value)
-   function Array.prototype.removeItem(value)
-   function Date.prototype.addDays(days)
-   function Date.prototype.addSeconds(seconds)
-   function Date.prototype.isNHoursOld(n)
