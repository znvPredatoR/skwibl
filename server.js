
/**
 * Module dependencies.
 */

var http = require('http')
  , cookie = require('cookie')
  , io = require('socket.io');

var db = require('./db')
  , cfg = require('./config');

var server = http.createServer()
  , sio = io.listen(server);

sio.set('authorization', function(data, accept){
  if (!data.headers.cookie) {
    return accept('Session cookie required.', false);
  }
  data.cookie = cookie.parse(data.headers.cookie);
  console.log(data.cookie);
  data.sessionId = data.cookie[cfg.SESSION_KEY].substring(2, 26);
  console.log(data.sessionId);
  db.sessions.get(data.sessionId, function(err, session){
    if(err) {
      return accept('Error in session store.', false);
    } else if(!session) {
      return accept('Session not found.', false);
    }
    var sessionData = JSON.parse(session);
    if(!sessionData.passport.user) {
      return accept('User not logged in', false);
    }
    data.session = sessionData;
    return accept(null, true);
  });
});

var activity = sio.of('/activity');

activity.on('connection', function(socket) {

  var hs = socket.handshake;
  console.log('A socket with sessionId '+hs.sessionId+' connected.');

  socket.on('disconnect', function(){
    console.log('A socket with sessionId ' + hs.sessionId + ' disconnected.');
  });

});

var chat = sio.of('/chat');

chat.on('connection', function(socket) {

  var hs = socket.handshake;
  console.log('A socket with sessionId '+hs.sessionId+' connected.');

  socket.json.emit('list', users);
  socket.broadcast.json.emit('enter', hs.session.name);

  socket.on('message', function(message) {
    socket.broadcast.json.emit({
      id: hs.session.uid,
      message: message,
      time: new Date
    });
  });

  socket.on('disconnect', function(){
    console.log('A socket with sessionId ' + hs.sessionId + ' disconnected.');
  });

});

server.listen(cfg.SOCKET_PORT, cfg.HOST, function() {
  console.log('socket.io serer is started on ' + cfg.HOST + ':' + cfg.SOCKET_PORT + ' in ' + process.env.NODE_ENV + ' mode');
});
