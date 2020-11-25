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
function objectMap (obj, fn) {
  return Object.fromEntries(
    Object.entries(obj).map(
      ([k, v], i) => [k, fn(v, k, i)]
    )
  )};

function objectKeysMap(obj, fn) {
  return Object.fromEntries(
    Object.entries(obj).map(
      ([k, v], i) => [fn(k), v]
    )
  )};

function objectKeysToLowerCase(obj) {
   return objectKeysMap(obj, x => x.toLowerCase());
}

function arrayToObjKeys (arr) {
    return arr.reduce( (a, b) => {
        a[b] = '';
        return (a[b], a)
    }, {});
}

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

const defaultStorage = {
    "retweetBlacklist" : [],
    // {"exampleAccount1" : ["mutedword1", "mutedword2"]}
    "mutedWordByUser" : {},
    "mediaOnlyUsers" : [],
    "noRetweet" : []
}

// initializes storage if not initialized yet
Object.keys(defaultStorage).forEach( k => {
    if (! GM_getValue(k)) {
        GM_setValue(k, defaultStorage[k]);
    }
})

function getStorageValue(name) {
    let stored = GM_getValue(name);
    console.log(name, stored);
    if (stored instanceof Array) {
        let lowercase = stored.map( (user) => user.toLowerCase() );
        return arrayToObjKeys(lowercase);
    }
    // is object
    return objectKeysToLowerCase(stored);
}

function getStorage() {
    let storage = {};
    Object.keys(defaultStorage).forEach ( k => {
        storage[k] = getStorageValue(k)
    });
    return storage;
}

function updateStorage() {
    Object.keys(storage).forEach (k => {
        let value = storage[k];
        if (defaultStorage[k] instanceof Array) {
            value = Object.keys(storage[k]);
        }
        GM_setValue(k, value);
    })
}

var storage = getStorage();

function linkToUsername (link) {
    if (! link) return "";
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

    let replyCondition = replier && (user in storage.retweetBlacklist || replier in retweetBlacklist);
    if (replyCondition) {
        return replier + ' replied to ' + user;
    }

    let retweetCondition = retweeter && user in storage.retweetBlacklist;
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
    let mutedWords = storage.mutedWordByUser[info.user];
    if (info.content && mutedWords) {
        let word = wordsInText(mutedWords, info.content);
        if (word) {
            return 'word ' + word + ' for user ' + info.user;
        }
    }
    return false;
}

function isTextByMediaOnlyUser (tweet) {
    let info = tweetInfo(tweet);
    let mediaStrings = ["t.co/", "pic.twitter.com"]
    if (info.user in storage.mediaOnlyUsers && (! wordsInText(mediaStrings, info.content))) {
        return 'non-media tweet for user ' + info.user;
    }
}

function isNoRetweetUser (tweet) {
    let info = tweetInfo(tweet);
    if (info.retweeter in storage.noRetweet) {
        return 'retweet from user' + info.retweeter;
    }
}

const customConditions = [
   isSelfRetweet,
   inBlacklist,
   hasMutedWordByUser,
   isTextByMediaOnlyUser,
   isNoRetweetUser
];

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

// Framework https://github.com/jorgebucaran/hyperapp/

var SSR_NODE = 1
var EMPTY_ARR = []
var TEXT_NODE = 3
var EMPTY_OBJ = {}
var SVG_NS = "http://www.w3.org/2000/svg"

var id = (a) => a
var map = EMPTY_ARR.map
var isArray = Array.isArray
var enqueue =
  typeof requestAnimationFrame !== "undefined"
    ? requestAnimationFrame
    : setTimeout

var createClass = (obj) => {
  var out = ""

  if (typeof obj === "string") return obj

  if (isArray(obj)) {
    for (var k = 0, tmp; k < obj.length; k++) {
      if ((tmp = createClass(obj[k]))) {
        out += (out && " ") + tmp
      }
    }
  } else {
    for (var k in obj) {
      if (obj[k]) out += (out && " ") + k
    }
  }

  return out
}

var shouldRestart = (a, b) => {
  for (var k in { ...a, ...b }) {
    if (typeof (isArray((b[k] = a[k])) ? b[k][0] : b[k]) === "function") {
    } else if (a[k] !== b[k]) return true
  }
}

var patchSubs = (oldSubs, newSubs, dispatch) => {
  for (
    var subs = [], i = 0, oldSub, newSub;
    i < oldSubs.length || i < newSubs.length;
    i++
  ) {
    oldSub = oldSubs[i]
    newSub = newSubs[i]

    subs.push(
      newSub && newSub !== true
        ? !oldSub ||
          newSub[0] !== oldSub[0] ||
          shouldRestart(newSub[1], oldSub[1])
          ? [
              newSub[0],
              newSub[1],
              newSub[0](dispatch, newSub[1]),
              oldSub && oldSub[2](),
            ]
          : oldSub
        : oldSub && oldSub[2]()
    )
  }
  return subs
}

var getKey = (vdom) => (vdom == null ? vdom : vdom.key)

var patchProperty = (node, key, oldValue, newValue, listener, isSvg) => {
  if (key === "key") {
  } else if (key === "style") {
    for (var k in { ...oldValue, ...newValue }) {
      oldValue = newValue == null || newValue[k] == null ? "" : newValue[k]
      if (k[0] === "-") {
        node[key].setProperty(k, oldValue)
      } else {
        node[key][k] = oldValue
      }
    }
  } else if (key[0] === "o" && key[1] === "n") {
    if (!((node.tag || (node.tag = {}))[(key = key.slice(2))] = newValue)) {
      node.removeEventListener(key, listener)
    } else if (!oldValue) {
      node.addEventListener(key, listener)
    }
  } else if (!isSvg && key !== "list" && key !== "form" && key in node) {
    node[key] = newValue == null ? "" : newValue
  } else if (
    newValue == null ||
    newValue === false ||
    (key === "class" && !(newValue = createClass(newValue)))
  ) {
    node.removeAttribute(key)
  } else {
    node.setAttribute(key, newValue)
  }
}

var createNode = (vdom, listener, isSvg) => {
  var props = vdom.props
  var node =
    vdom.tag === TEXT_NODE
      ? document.createTextNode(vdom.type)
      : (isSvg = isSvg || vdom.type === "svg")
      ? document.createElementNS(SVG_NS, vdom.type, { is: props.is })
      : document.createElement(vdom.type, { is: props.is })

  for (var k in props) {
    patchProperty(node, k, null, props[k], listener, isSvg)
  }

  for (var i = 0; i < vdom.children.length; i++) {
    node.appendChild(
      createNode(
        (vdom.children[i] = maybeVNode(vdom.children[i])),
        listener,
        isSvg
      )
    )
  }

  return (vdom.node = node)
}

var patch = (parent, node, oldVNode, newVNode, listener, isSvg) => {
  if (oldVNode === newVNode) {
  } else if (
    oldVNode != null &&
    oldVNode.tag === TEXT_NODE &&
    newVNode.tag === TEXT_NODE
  ) {
    if (oldVNode.type !== newVNode.type) node.nodeValue = newVNode.type
  } else if (oldVNode == null || oldVNode.type !== newVNode.type) {
    node = parent.insertBefore(
      createNode((newVNode = maybeVNode(newVNode)), listener, isSvg),
      node
    )
    if (oldVNode != null) {
      parent.removeChild(oldVNode.node)
    }
  } else {
    var tmpVKid
    var oldVKid

    var oldKey
    var newKey

    var oldProps = oldVNode.props
    var newProps = newVNode.props

    var oldVKids = oldVNode.children
    var newVKids = newVNode.children

    var oldHead = 0
    var newHead = 0
    var oldTail = oldVKids.length - 1
    var newTail = newVKids.length - 1

    isSvg = isSvg || newVNode.type === "svg"

    for (var i in { ...oldProps, ...newProps }) {
      if (
        (i === "value" || i === "selected" || i === "checked"
          ? node[i]
          : oldProps[i]) !== newProps[i]
      ) {
        patchProperty(node, i, oldProps[i], newProps[i], listener, isSvg)
      }
    }

    while (newHead <= newTail && oldHead <= oldTail) {
      if (
        (oldKey = getKey(oldVKids[oldHead])) == null ||
        oldKey !== getKey(newVKids[newHead])
      ) {
        break
      }

      patch(
        node,
        oldVKids[oldHead].node,
        oldVKids[oldHead],
        (newVKids[newHead] = maybeVNode(
          newVKids[newHead++],
          oldVKids[oldHead++]
        )),
        listener,
        isSvg
      )
    }

    while (newHead <= newTail && oldHead <= oldTail) {
      if (
        (oldKey = getKey(oldVKids[oldTail])) == null ||
        oldKey !== getKey(newVKids[newTail])
      ) {
        break
      }

      patch(
        node,
        oldVKids[oldTail].node,
        oldVKids[oldTail],
        (newVKids[newTail] = maybeVNode(
          newVKids[newTail--],
          oldVKids[oldTail--]
        )),
        listener,
        isSvg
      )
    }

    if (oldHead > oldTail) {
      while (newHead <= newTail) {
        node.insertBefore(
          createNode(
            (newVKids[newHead] = maybeVNode(newVKids[newHead++])),
            listener,
            isSvg
          ),
          (oldVKid = oldVKids[oldHead]) && oldVKid.node
        )
      }
    } else if (newHead > newTail) {
      while (oldHead <= oldTail) {
        node.removeChild(oldVKids[oldHead++].node)
      }
    } else {
      for (var keyed = {}, newKeyed = {}, i = oldHead; i <= oldTail; i++) {
        if ((oldKey = oldVKids[i].key) != null) {
          keyed[oldKey] = oldVKids[i]
        }
      }

      while (newHead <= newTail) {
        oldKey = getKey((oldVKid = oldVKids[oldHead]))
        newKey = getKey(
          (newVKids[newHead] = maybeVNode(newVKids[newHead], oldVKid))
        )

        if (
          newKeyed[oldKey] ||
          (newKey != null && newKey === getKey(oldVKids[oldHead + 1]))
        ) {
          if (oldKey == null) {
            node.removeChild(oldVKid.node)
          }
          oldHead++
          continue
        }

        if (newKey == null || oldVNode.tag === SSR_NODE) {
          if (oldKey == null) {
            patch(
              node,
              oldVKid && oldVKid.node,
              oldVKid,
              newVKids[newHead],
              listener,
              isSvg
            )
            newHead++
          }
          oldHead++
        } else {
          if (oldKey === newKey) {
            patch(
              node,
              oldVKid.node,
              oldVKid,
              newVKids[newHead],
              listener,
              isSvg
            )
            newKeyed[newKey] = true
            oldHead++
          } else {
            if ((tmpVKid = keyed[newKey]) != null) {
              patch(
                node,
                node.insertBefore(tmpVKid.node, oldVKid && oldVKid.node),
                tmpVKid,
                newVKids[newHead],
                listener,
                isSvg
              )
              newKeyed[newKey] = true
            } else {
              patch(
                node,
                oldVKid && oldVKid.node,
                null,
                newVKids[newHead],
                listener,
                isSvg
              )
            }
          }
          newHead++
        }
      }

      while (oldHead <= oldTail) {
        if (getKey((oldVKid = oldVKids[oldHead++])) == null) {
          node.removeChild(oldVKid.node)
        }
      }

      for (var i in keyed) {
        if (newKeyed[i] == null) {
          node.removeChild(keyed[i].node)
        }
      }
    }
  }

  return (newVNode.node = node)
}

var propsChanged = (a, b) => {
  for (var k in a) if (a[k] !== b[k]) return true
  for (var k in b) if (a[k] !== b[k]) return true
}

var maybeVNode = (newVNode, oldVNode) =>
  newVNode !== true && newVNode !== false && newVNode
    ? typeof newVNode.tag === "function"
      ? ((!oldVNode ||
          oldVNode.memo == null ||
          propsChanged(oldVNode.memo, newVNode.memo)) &&
          ((oldVNode = newVNode.tag(newVNode.memo)).memo = newVNode.memo),
        oldVNode)
      : newVNode
    : text("")

var recycleNode = (node) =>
  node.nodeType === TEXT_NODE
    ? text(node.nodeValue, node)
    : createVNode(
        node.nodeName.toLowerCase(),
        EMPTY_OBJ,
        map.call(node.childNodes, recycleNode),
        node,
        null,
        SSR_NODE
      )

var createVNode = (type, props, children, node, key, tag) => ({
  type,
  props,
  children,
  node,
  key,
  tag,
})

var memo = (tag, memo) => ({ tag, memo })

var text = (value, node) =>
  createVNode(value, EMPTY_OBJ, EMPTY_ARR, node, null, TEXT_NODE)

var h = (type, props, children) =>
  createVNode(
    type,
    props,
    isArray(children) ? children : children == null ? EMPTY_ARR : [children],
    null,
    props.key
  )

var app = (props) => {
  var view = props.view
  var node = props.node
  var subscriptions = props.subscriptions
  var vdom = node && recycleNode(node)
  var subs = []
  var doing
  var state

  var setState = (newState) => {
    if (state !== newState) {
      state = newState
      if (subscriptions) {
        subs = patchSubs(subs, subscriptions(state), dispatch)
      }
      if (view && !doing) enqueue(render, (doing = true))
    }
  }

  var dispatch = (props.middleware || id)((action, props) =>
    typeof action === "function"
      ? dispatch(action(state, props))
      : isArray(action)
      ? typeof action[0] === "function"
        ? dispatch(action[0], action[1])
        : action
            .slice(1)
            .map(
              (fx) => fx && fx !== true && fx[0](dispatch, fx[1]),
              setState(action[0])
            )
      : setState(action)
  )

  var listener = function (event) {
    dispatch(this.tag[event.type], event)
  }

  var render = () =>
    (node = patch(
      node.parentNode,
      node,
      vdom,
      (vdom = view(state)),
      listener,
      (doing = false)
    ))

  dispatch(props.init)
}


/*
 Button to add user to blacklist
*/

// AUX

function newNode(html) {
    let div = document.createElement('div');
    div.innerHTML = html.trim();
    return div.firstChild;
}

let profileNode = document.querySelector("div.js-modals-container");

// MODEL

// making the model depend on the storage variables
// so we alter the storage variables and the model changes

function get_profile_user() {
    if ( (!profileNode) || profileNode.children.length == 0) return "";
    let link = profileNode.querySelector("a.js-action-url.link-clean").getAttribute("href");
    let user = linkToUsername(link);
    return user;
}

function initialize_model() {
    user(get_profile_user());
}

// UPDATE

function genericAdd(dict) {
    dict[user()] = "";
    updateStorage();
    refresh();
}

function genericRemove(dict) {
    delete dict[user()];
    updateStorage();
    refresh();
}

function addToMediaOnly(){
    genericAdd(storage.mediaOnlyUsers);
    console.log("Block text only posts from ", user());
}

function removeFromMediaOnly() {
    genericRemove(storage.mediaOnlyUsers);
    console.log("Unblocked text only posts from ", user());
}

function blockRetweet(){
    genericAdd(storage.noRetweet);
    console.log("Blocked user", user(), "from retweeting");
}

function unblockRetweet() {
    genericRemove(storage.noRetweet);
    console.log("Unblocked user", user(), "from retweeting");
}


// VIEW

function generic_button (state_function, yes_text, no_text, yes_fn, no_fn) {
    // using nodes just to be able to set onclick in a way that works with tampermonkey
    let button = newNode (`
        <button class="btn-on-dark">
        <span class="label">${no_text}</span>
        </button>
        `);
    button.onclick = no_fn;
    if (state_function()) {
        button = newNode (`
        <button class="btn-on-dark">
        <span class="label">${yes_text}</span>
        </button>
        `);
        button.onclick = yes_fn;
    }
    return button;
}

// when a function is passed to state, state will execute the function to get an initial value.
// executing button() will also execute the function
// so i passed a function just to be able to pass arguments to generic_button
//let button_block_replies = state(() => generic_button(block_replies, "Unblock replies and self retweets", "Block replies and self retweets", removeFromBlacklist, addToBlacklist));
//let button_media_only = state(() => generic_button(media_only, "Unblock text posts", "Block text posts", removeFromMediaOnly, addToMediaOnly));
//let button_no_retweet = state(() => generic_button(no_retweet, "Unblock from retweeting", "Block from retweeting", unblockRetweet, blockRetweet));

//let buttons = [button_block_replies, button_media_only, button_no_retweet];

// APP

function add_div_profile () {
    if ( (!profileNode) || profileNode.children.length == 0) return "";
    let link = profileNode.querySelector("a.js-action-url.link-clean").getAttribute("href");
    let user = linkToUsername(link);

    let div = newNode(`<div id='tweetdeck-suite'><div>`)
    let parentNode = profileNode.querySelector("div.prf-actions");
    let childNode = parentNode.querySelector("div.js-social-proof.social-proof-container");
    parentNode.insertBefore(div, childNode);
    return div;
};


function initialize_profile () {
    add_div_profile();
    app();
}

// refresh is the app which is a function that sets the content of the div to the view. the app updates by recalling the function
var refresh = app;



const flipBlacklist = (state) => {
    if (user in state.retweetBlacklist) {
        delete(state.retweetBlacklist[user]);
        state.text_block_replies = button_texts.block_replies[0];
        console.log("Added user", user, "to blacklist");
    }
    else {
        state.retweetBlacklist[user] = "";
        state.text_block_replies = button_texts.block_replies[1];
        console.log("Removed user", user, "from blacklist");
    }
    updateStorage();
    return state;
}

function removeFromBlacklist(state) {
    console.log("Removed user", user, "from blacklist");
    return
}

let user = "";
let button_texts = {
    block_replies : ["Remove from blacklist", "Add to blacklist"]
}

let appaaaa = "";

function initializeApp () {
    add_div_profile();
    user = get_profile_user();
    if (user == "") return;

    appaaaa = app({
    init: {...storage,
               text_block_replies : button_texts.block_replies[user in storage.retweetBlacklist ? 1 : 0]
          },
    view: ({ retweetBlacklist, text_block_replies}) =>
    h("main", {}, [
        h("button", {onclick: flipBlacklist}, text(text_block_replies))
    ]),
    node: document.getElementById("tweetdeck-suite"),
})
}

new MutationObserver(initializeApp).observe(profileNode, { childList: true});