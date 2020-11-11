// ==UserScript==
// @name            Tweetdeck hide self retweets and blacklist retweets and replies of accounts
// @namespace       https://github.com/argit2/tweetdeck-blacklist
// @version         0.0.6
// @license         GPL-3.0-or-later
// @supportURL      https://github.com/argit2/tweetdeck-blacklist
// @description     Hide self retweets. Blacklist accounts to not see retweets of their posts. Very useful when you have a group of users that retweet each other.
// @author          argit2
// @include         https://tweetdeck.twitter.com*
// @grant           GM_getValue
// @grant           GM_setValue
// ==/UserScript==

/* INSTRUCTIONS

Click on a user on tweetdeck to access the user profile. The button to add or remove from list will be there.

You can see and modify the full list of users by doing this:

1) Access tweetdeck.
2) Click on tampermonkey icon, right click on the script to access the page where you edit the script. Go to the Storage tab of the script and include the accounts you would like to not see retweets of. The storage tab is only visible if you have the advanced settings turned on inside of Tampermonkey.
3) Click save.
You can check which tweets are being removed in the console in the developer tools of your browser.
In Firefox: Ctrl Shift K
In Chrome: Ctrl Shift J

PS: I use storage instead of a variable so your blacklisted accounts are preserved across updates of the script
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
if (! GM_getValue("mutedWordByUser")) {
  GM_setValue("mutedWordByUser", {"exampleAccount1" : ["mutedword1", "mutedword2"]});
}

let storage = GM_getValue("retweetBlacklist").map( (user) => user.toLowerCase() );
console.log(storage);
var retweetBlacklist = arrayToObjKeys(storage);
var mutedWordByUser = GM_getValue("mutedWordByUser");

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

function tweetContent (tweet) {
    let elementWithText = tweet.querySelector(elementToCheckForWords);
            // Apparently sometimes a tweet has no text, only image
    let textContent = "";
    if (elementWithText) {
        textContent = elementWithText.textContent.toLowerCase();
    }
    return textContent;
}

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


function tweetInfo(tweet) {
    // this is pain, i had a similar function that corrected who was the user and who was the replier, but i lost it. lazy to do it now. will keep the usual values.
    let user = whoTweeted(tweet);
    let retweeter = whoRetweeted(tweet);
    let replier = whoReplied(tweet);
    let content = tweetContent(tweet);
    let info = {
        "user" : user,
        "retweeter" : retweeter ,
        "replier" : replier,
        "content" : content,
    };
    return info;
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

function hasMutedWordByUser (tweet) {
    let info = tweetInfo(tweet);
    let mutedWords = mutedWordByUser[info.user];
    if (info.content && mutedWords) {
        let word = wordsInText(mutedWords, info.content);
        if (word) {
            return 'word ' + word + ' for user' + info.user;
        }
    }
    return false;
}

const customConditions = [
   isSelfRetweet,
   inBlacklist,
   hasMutedWordByUser
];


function wordsInText (regs, text) {
    let word = ""
    let found = (regs.some( (reg, index) => {
        word = reg.toString();
        // easier than checking if is string
        if (! (reg instanceof RegExp)) {
            return (new RegExp(reg).test(text));
        }
        return reg.test(text);
    }))
    if (found) {
        return word;
    }
    return false;
}

const elementToObserve = "div.js-chirp-container" ; // columns
const elementToRemove = "article.stream-item" ; // tweet
const elementToCheckForWords = ".js-tweet-text" ;

(() => {
    "use strict";

    // so we can check if words are in the text alone
    // example: will match only "vlog" alone but not "devvlog" because not alone
    const regexes = bannedWords.map( (word) => {return new RegExp(`(?<![a-zA-Z])${word}(?![a-zA-Z])`)} );

    function filterTweets (column) {
        // sometimes there's an array of changes (apparently corresponds to show the more elements section appearing, old tweets being removed, and new tweets being added).
        // we pick only the added elements if possible. in many cases this doesn't make a difference
        // because as you scroll down, tweetdeck might reload all the tweets
        // but sometimes it won't.
        // then for example there are 40 tweets and only 3 of them are new (actually happens)
        // filtering only new elements reduces weird behavior
        // example: page moving suddenly because of many tweets being hidden
        let nodes = [];
        if (column instanceof Array) {
            let addedNodes = column.map( (ele) => Array.from(ele.addedNodes.values()));
            nodes = addedNodes.flat();
        }
        // might only happen when it's an array like above, but will keep it there anyway
        else if (column instanceof MutationRecord)
        {
            nodes = column.addedNodes;
        }
        else {
            nodes = column.querySelectorAll(elementToRemove);
        }
        nodes.forEach(tweet => {
            let textContent = tweetContent(tweet);
            if (textContent) {
                let found = wordsInText(regexes, textContent);
                if (found) {
                    console.log(`Removing ${found} : ${textContent}`);
                    tweet.style.display = "none";
                    return;
                }
            }

            // removes if match custom conditions
            for (const condition of customConditions) {
                let cond = condition(tweet);
                if (cond) {
                    console.log(`Removing '${cond}' : ${textContent}`);
                    tweet.style.display = "none";
                    return;

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
            filterTweets(column);
            new MutationObserver(filterTweets).observe(column, { childList: true});
        }
    }, 2000);

})();

/*
 Button to add user to blacklist
*/

function updateStorage() {
  GM_setValue("retweetBlacklist", Object.keys(retweetBlacklist));
}

function newNode(html) {
    let div = document.createElement('div');
    div.innerHTML = html.trim();
    return div.firstChild;
}

let profileNode = document.querySelector("div.js-modals-container");
function addButtonToProfile() {
    if ( (!profileNode) || profileNode.children.length == 0) return;
    let link = profileNode.querySelector("a.js-action-url.link-clean").getAttribute("href");
    let user = linkToUsername(link);

    function addToBlacklist(){
        retweetBlacklist[user] = "";
        updateStorage();
        console.log("Added user", user, "to blacklist.");
    }

    function removeFromBlacklist() {
        delete retweetBlacklist[user];
        updateStorage();
        console.log("Removed user", user, "from blacklist");
    }

    let button = newNode (`
        <button class="btn-on-dark">
        <span class="label">Block replies and self retweets.</span>
        </button>
        `);
    button.onclick = addToBlacklist;
    if (user in retweetBlacklist) {
            button = newNode(`
                <button class="btn-on-dark" onclick="removeFromBlacklist(${user})">
                <span class="label">Unblock replies and self retweets.</span>
                </button>
                `);
            button.onclick = removeFromBlacklist;
    }
    let parentNode = profileNode.querySelector("div.prf-actions");
    let childNode = parentNode.querySelector("div.js-social-proof.social-proof-container");
    parentNode.insertBefore(button, childNode);
}

new MutationObserver(addButtonToProfile).observe(profileNode, { childList: true});