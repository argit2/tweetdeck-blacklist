// ==UserScript==
// @name            Tweetdeck hide self retweets and blacklist retweets and replies of accounts
// @namespace       https://github.com/argit2/tweetdeck-blacklist
// @version         0.0.3
// @license         GPL-3.0-or-later
// @supportURL      https://github.com/argit2/tweetdeck-blacklist
// @description     Hide self retweets. Blacklist accounts to not see retweets of their posts. Very useful when you have a group of users that retweet each other.
// @author          argit2
// @include         https://tweetdeck.twitter.com*
// @grant           GM_getValue
// @grant           GM_setValue
// ==/UserScript==

/* INSTRUCTIONS
 * 1) Access tweetdeck.
 * 2) Alter the Storage tab of the script (it's above) and include the accounts you would like to not see retweets of.
 * 3) Click save.
 * You can check which tweets are being removed in the console in the developer tools of your browser.
 * In Firefox: Ctrl Shift K
 * In Chrome: Ctrl Shift J
 * PS: I use storage instead of a variable so your blacklisted accounts are preserved across updates of the script
 */

// For self reference: based on my other youtube blacklist script, so any time you see "video" think it as "tweet".

const bannedWords = [
];

// returns a new object with the values at each key mapped using mapFn(value)
const objectMap = (obj, fn) => {
  Object.fromEntries(
    Object.entries(obj).map(
      ([k, v], i) => [k, fn(v, k, i)]
    )
  )};

const arrayToObjKeys = (arr) => {
    return arr.reduce( (a, b) => {
        a[b] = '';
        return (a[b], a)
    }, {});
}

// initializes storage if not initialized yet
if (! GM_getValue("retweetBlacklist")) {
  GM_setValue("retweetBlacklist", ["exampleaccount1", "exampleaccount2"]);
}

let storage = GM_getValue("retweetBlacklist").map( (user) => user.toLowerCase() );
console.log(storage);
const retweetBlacklist = arrayToObjKeys(storage);

function linkToUsername (link) {
    let split = link.split("/");
    let last = split[split.length - 1];
    // link ends in /, example twitter.com/whateveruser/
    if (last == "") {
        return split[split.length - 2];
    }
    return last.toLowerCase();
}

const nobody = "random username that nobody will ever have";

const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

function whoTweeted (tweet) {
    // when you scroll for a while, tweetdeck will display "show more" instead of new tweets and there'll be no link
    try {
        let linkElement = tweet.querySelector("a.account-link.link-complex");
        let link = linkElement.getAttribute("href");
        return linkToUsername(link);
    }
    catch {
        return nobody;
    }
}

function whoRetweeted (tweet) {
    // returns false if isn't retweet, returns who retweeted if true
    let retweet = tweet.querySelector("div.nbfc a")
    if (! retweet) {
        return false;
    }
    let user = linkToUsername(retweet.getAttribute("href"))
    // is reply instead of retweet
    if (user == "#") {
            //user = retweet.innerText.substring(1);
            return false;
        }
    return user;
}

function whoReplied (tweet) {
    // returns false if isn't reply, returns who replied if true
    let reply = tweet.querySelector("div.nbfc a")
    if (! reply) {
        return false;
    }
    let retweetUser = linkToUsername(reply.getAttribute("href"))
    // is reply instead of retweet
    if (retweetUser != "#") {
            return false;
        }
    return reply.innerText.substring(1);
}

function inBlacklist (tweet) {

    let user = whoTweeted(tweet);
    let retweeter = whoRetweeted(tweet);
    let replier = whoReplied(tweet);

    let replyCondition = replier && (user in retweetBlacklist || replier in retweetBlacklist);
    if (replyCondition) {
        return replier + ' replied to ' + user;
    }

    let retweetCondition = retweeter && user in retweetBlacklist;
    if (retweetCondition) {
        return retweeter + ' retweeted ' + user;
    }
    return false
}

function isSelfRetweet (tweet) {
    let user = whoTweeted(tweet)
    let condition = user == whoRetweeted(tweet);
    if (condition) {
        return 'self retweet ' + user;
    }
    return false
};

const customConditions = [
   isSelfRetweet,
   inBlacklist,
];

const elementToObserve = "div.js-chirp-container" ; // columns
const elementToRemove = "article.stream-item" ; // tweet
const elementToCheckForWords = ".js-tweet-text" ;

(() => {
    "use strict";


    const regexes = bannedWords.map( (word) => {return new RegExp(`(?<![a-zA-Z])${word}(?![a-zA-Z])`)} );
    //console.log(regexes);
    //var lastSection = 0;

    // returns true if any of the words is in the text alone
    // example: will match only "vlog" alone but not "devvlog" because not alone
    function wordsInText (regs, text) {
        let word = ""
        let found = (regs.some( (reg, index) => {
            //console.log(reg, text, reg.test(text))
            word = bannedWords[index];
            return reg.test(text);
        }))
        if (found) {
            return word;
        }
        return false;
    }

    function filterVideos (column) {
        // sometimes there's an array of changes, pick last one
        if (column instanceof Array) {
            column = column[column.length - 1];
        }
        // for some reason i get a mutation record??? this doesn't happen on youtube, might have to do with const
        if (column instanceof MutationRecord)
        {
            column = column.target;
        }
        column.querySelectorAll(elementToRemove).forEach(video => {
            // removes videos with blacklisted titles
            let elementWithText = video.querySelector(elementToCheckForWords);
            // Apparently sometimes a tweet has no text, only image
            let textContent = "";
            if (elementWithText) {
                textContent = elementWithText.textContent.toLowerCase();
                let found = wordsInText(regexes, textContent);
                if (found) {
                    console.log(`Removing ${found} : ${textContent}`);
                    return video.remove();
                }
            }

            // removes if match custom conditions
            let allTextContent = video.textContent.toLowerCase();
            for (const condition of customConditions) {
                let cond = condition(video);
                if (cond) {
                    console.log(`Removing '${cond}' : ${textContent}`);
                    return video.remove();

                }
            }

        });
    }

    // wait for videos to load.
    const interval = setTimeout(() => {
        // div containing videos
        const videos = document.querySelectorAll(elementToObserve);
        if (!videos) {
            console.log("Didn't find columns");
            return;
        }
        console.log("Found columns");
        clearInterval(interval);

        // observes new sections of videos being added to the subscription page
        // and removes videos that have blacklisted words
        for (const column of videos) {
            filterVideos(column);
            new MutationObserver(filterVideos).observe(column, { childList: true});
        }
    }, 2000);

})();