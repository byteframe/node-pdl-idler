// adjust profile privacy settings | 3-3-3-3-3-0-1
var privacy_time = -1
  , privacy_interval = 9000;
global.privacy_queue = (callback, targets, arg) =>
  (!/[1-3][-][1-3][-][1-3][-][1-3][-][1-3]/.test(arg)) ?
    tprint("ERROR! invalid privacy: " + arg)
  : callback(targets.map((target) => [ target, 'privacy', arg ]));
global.privacy = (account, arg) =>
  login(account, "", () =>
    setTimeout(() => (
      privacy_time = new Date().getTime()+privacy_interval,
      account.community.profileSettings({
        profile: 3,// arg.substr(0, 1),
        comments: 3,//arg.substr(2, 1),
        inventory: 3,//arg.substr(4, 1),
        friendsList: 3,//arg.substr(6, 1),
        gameDetails: 3,//arg.substr(8, 1),
        playtime: 3,//(arg.substr(12, 1) == '1'),
        inventoryGifts: 3,//(arg.substr(14, 1) == '1')
      }, (err) =>
        output(account, err, 'privacy', arg))
    ), privacy_time-new Date().getTime()));

// upload avatar image $URL
var avatar_time = -1
  , avatar_interval = 12000;
global.avatar_queue = (callback, targets, arg = 'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/fe/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg') =>
  callback(targets.map((target) => [ target, 'avatar', arg ]));
global.avatar = (account, args) =>
  setTimeout(() => (
    avatar_time = new Date().getTime()+avatar_interval,
    login(account, "", () =>
      account.community.uploadAvatar(args, null, (err, url) =>
        output(account, err, 'avatar', (err ? 'error' : url.substr(-10)))))
  ), avatar_time-new Date().getTime());

// set persona state
global.persona_queue = (callback, targets, arg) =>
  callback(targets.map((target) => [ target, 'persona', +arg ]));
global.persona = (account, arg) =>
  login(account, "", () => (
    account.user.setPersona(arg),
    output(account, false, 'persona', arg)));

// set player name XXX arg
global.rename_queue = (callback, targets, arg) =>
  callback(targets.map((target) => [ target, 'rename', arg ]));
global.rename = (account, arg) =>
  login(account, "", () =>
    account.user.getAliases(account.user.steamID, (err, results) => (
      account.user.setPersona(SteamUser.EPersonaState.Offline, arg),
      output(account, false, 'rename', "now=" + arg))));

// #############################################################################
// ANOTHER USER?
// WIKIPEDIA PAGE?
/*global.profile = (account, args) {
  //
  for (var prop in account.user.myFriends) {
    if (`${account.user.myFriends[prop]}` == 2) {
      console.log('http://steamcommunity.com/profiles/' + `${prop}`)
      account.user.removeFriend(`${prop}`);
    }
  }
  account.community.httpRequestGet({
    "uri": 'https://en.wikipedinput.match(/(?:[^\s"]+|"[^"]*")+/g)ia.org/wiki/' + args[a],
  }, (err, response, body) {
    //output(account, err, 'rate', args[a][0]+args[a][1]);
    //console.log($('h1').children().first().text());
    //console.log($('p').children().first().text());
    var $ = Cheerio.load(body);
    console.log($('h1')[0].children[0].data);
    console.log($('p').eq(0).text());
   // console.log($('p')[0].data);
  }, "wikipedia.org");
};*/

// #############################################################################
// https://gist.github.com/Ne3tCode/7ac3dbf68707a7f262b1db83bdae97ae
// XXX complete some of the community badge objectives
// http://steamcommunity.com/profiles/76561198178392694/badges/2
// 1-96,201-232,101-104,133,165 vote discover
// 1-96,201-232,101-104,133,165 play=badge
//https://paste.ee/p/9jw5U
// MISC CARDS done on 201-232 rest remain
// CURRENTLY doing 1-64,101-104,133,165
/*global.socialize_queue = (targets) => {
  targets.forEach((target, index) => {
    action_queue.push([target, 'socialize', '']);
  });
  // XXX enqueue actions seperately? for  code readability,indents?
  // dont in th end prolly need seperat eactions seeing its other stuff
  // some kind of list thing. array of funcutions?
  //socialize could enqueue actions  seperately
  // use request to check the badge? will it work on privates? no 
};
global.socialize = (account, arg) => {
  login(account, '', () => {
    account.community.httpRequestGet({
      "uri": "http://steamcommunity.com/my/badges/2",
    }, (err, response, body) => {
      [ [ 'ViewBroadcast', [ 'watch', 0 ], ],
        [ 'UseDiscoveryQueue', [ 'discover', 1 ], ],
        [ 'AddItemToWishlist', [ 'profile???', 1 ], ],
        [ 'AddFriendToFriendsList', [ 'profile???', 1 ], ],
        [ 'PlayGame', [ 'XXX', 1 ], ],
        [ 'RecommendGame', [ 'profile???', 1 ], ],
        [ 'PostScreenshot', [ 'profile???', 1 ], ],
        [ 'RateWorkshopItem', [ 'profile???', 1 ], ],
        [ 'SubscribeToWorkshopItem', [ 'profile???', 1 ], ],
        // ++setavatar
        [ 'SetupCommunityRealName', [ 'profile???', 1 ], ],
        // SetAprofileBackground
        [ 'JoinGroup', [ 'XXX', 1 ], ],
        [ 'PostCommentOnFriendsPage', [ 'profile???', 1 ], ],
        // [ 'RATEACTIVITYITEM', [ 'profile???', 1 ], ],
        [ 'PostStatusToFriends', [ 'profile???', 1 ], ],
        [ 'PostCommentOnFriendsScreenshot', [ 'profile???', 1 ], ],
        // FeatureABadgeOnAProfile
        // [ 'SearchSteamDiscussions', [ 'profile???', 1 ], ],
      ].forEach((badge_task) {
        if (body.indexOf(badge_task[0] + "_off")) {
          action_queue.unshift(account, badge_task[1][0], badge_task[1][1]);
        }
      });
      proceed();
    }, "steamcommunity.com");
  });
};
 25-7=EUseEmoticonInChat BCraftGameBadge TTrade AFacebook OInOverlay MOnMarket YPostVideo
global.watch = (account, arg) {
login???      // watch a broadcast
  account.community.httpRequestGet({
    "uri": 'http://steamcommunity.com/apps/allcontenthome?appHubSubSection=13',
  }, (err, response, body) {
    var match = body.match(/watch\/(\d+)/);
    if (!match) {
      return output(account, err, 'socialize', 'broadcast=no_match')
    }
    account.community.httpRequestGet({
      "uri": 'http://steamcommunity.com/broadcast/getbroadcastmpd/?steamid='
        + match[1] + '&broadcastid=0&viewertoken=0',
      "json": true
    }, (err, response, body) {
      output(account, err, 'socialize', 'broadcast=' + body.broadcastid)
    }, "steamcommunity.com");
  }, "steamcommunity.com");
};*/

