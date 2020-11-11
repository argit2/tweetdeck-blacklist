Repository for userscript "Tweetdeck hide self retweets and blacklist retweets and replies of accounts".
Available [here](https://greasyfork.org/en/scripts/411991-tweetdeck-hide-self-retweets-and-blacklist-retweets-of-accounts). Can be installed using the browser extension tampermonkey.

Based on the script YouTube Comment Blacklist by NatoBoram.

Ps: a "self retweet" is when a user retweets posts of themselves.

### INSTRUCTIONS

Click on a user on tweetdeck to access the user profile. The button to add or remove from list will be there.

You can see and modify the full list of users by doing this:

1) Access tweetdeck.
2) Click on tampermonkey icon, right click on the script to access the page where you edit the script. Go to the Storage tab of the script and include the accounts you would like to not see retweets of. The storage tab is only visible if you have the advanced settings turned on inside of Tampermonkey.
3) Click save.
You can check which tweets are being removed in the console in the developer tools of your browser.
In Firefox: Ctrl Shift K
In Chrome: Ctrl Shift J
PS: I use storage instead of a variable so your blacklisted accounts are preserved across updates of the script