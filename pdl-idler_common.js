// pdl-idler.js (0.100)
// Copyright (c) 2011-2018 byteframe@primarydataloop
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>

// print output message with timestamp
pad = (i) => ((i < 10) ? "0" + i : "" + i);
tprint = (line, newline = true, date = new Date()) =>
  ((line) => newline ? console.log(line) : process.stdout.write(line)
  )(('[' + pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' +
    pad(date.getSeconds()) + '] ').gray.dim + line);

// generic true/false output callback
output = (account, err, left, right, body = '', to_proceed = true) => {
  if (err === null && body !== '' && JSON.parse(body).success === false) {
    err = true;
  }
  if (account === null) {
    account = { name: "<" + os.hostname() + ">"};
  }
  var right_new = ''
    , status;
  if (!err) {
    status = 'SUCCESS'.green;
  } else if (!isNaN(err) && err == 11) {
    status = 'COMPLETE'.yellow;
  } else if (!isNaN(err) && err == 2) {
    status = 'NOTICE'.blue;
  } else {
    status = 'FAILURE'.red;
  }
  right = right.magenta.split(/[=,]/);
  for (var i = 0; i < right.length; i+=2) {
    right_new += right[i].underline.magenta.reset + '='.magenta;
    if (i != right.length-1) {
      right_new += right[i+1].bold.magenta.reset + ','.magenta;
    }
  }
  tprint(account.name.cyan + "| " + left.bold + " " + status + ": ".reset
    + right_new.magenta.substring(0, right_new.length-1).reset);
  if (to_proceed) {
    proceed();
  }
  return err;
};

// shuffle contents of an array/string
shuffle_array = (array) => {
  for (var i = array.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random()*(i + 1));
    var t = array[i];
    array[i] = array[j];
    array[j] = t;
  }
  return array;
};
String.prototype.shuffle = function() {
  var a = this.split(""), n = a.length;
  for(var i = n - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1)), tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a.join("");
}

// convert base64 to utf8 string
base64toUTF8 = (str) => new Buffer(str, 'base64').toString('utf8');

// request array of gmail messages;
var fs = require('fs');
const {google} = require('googleapis');
get_gmail = (email, callback, maxResults = 10, q = 'from:noreply@steampowered.com') => {
  var auth = emails[email];
  const googleAPIsGmail = google.gmail({ version: 'v1', auth });
  googleAPIsGmail.users.messages.list({
    auth: emails['pdlidler'], userId: 'me', maxResults: maxResults, q: q
  },(err, response, gmails = []) =>
    (err) ?
      console.dir(err)
    :(read_message = (m = 0) =>
      (m == response.data.messages.length) ?
        callback(false, gmails)
      : googleAPIsGmail.users.messages.get({
        auth: emails[email], userId: 'me', id: response.data.messages[m].id
      }, (err, response, body = '') => (
        response.data.payload.parts.forEach((part) => body += base64toUTF8(part.body.data)),
        gmails.push(body),
        read_message(m+1)))
    )())};

// search gmail messages for first instance of start/end string
search_gmail = (gmails, start, end) => {
  for (var i = 0; i < gmails.length; i++) {
    var start_index = gmails[i].indexOf(start);
    if (start_index > -1) {
      return gmails[i].slice(start_index, gmails[i].indexOf(end, start_index));
    }
  }
  return false;
};
