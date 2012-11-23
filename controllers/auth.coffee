request = require 'request'
qs = require 'querystring'

db = require '../db'
smtp = require '../smtp'
tools = require '../tools'
cfg = require '../config'

#
# GET
# main page
#
exports.mainPage = (req, res) ->
  return res.redirect '/projects' if req.user
  return res.render 'index', template: './mainpage'

#
# GET
# registration page
#
exports.regPage = (req, res) ->
  return res.render 'index', template:'users/new'

#
# POST
# Local registration
#
exports.register = (req, res, next) ->
  if req.body isnt null
    email = req.body.email
    db.users.findByEmail email, (err, user) ->
      return next err if err
      unless user
        hash = tools.hash email
        return db.users.add
          hash: hash
          displayName: req.body.name
          password: req.body.password
          status: 'unconfirmed'
          provider: 'local'
        , null, [
          value: email
          type: 'main'
        ], (err, user) ->
          return next err if err
          unless user
            tools.addError req, 'Enter valid email.'
            return res.redirect '/registration'
          return smtp.regNotify req, res, next, user, hash
      if user.status is 'deleted'
        return db.users.restore user, (err) ->
          unless err
            return smtp.passwordSend req, res, user, (err, message) ->
              if err
                req.flash 'error', "Unable send confirmation to #{email}"
                return res.redirect '/'
              else
                req.flash 'message', "Password successfuly sent to email: #{email}"
                return res.redirect '/checkmail'
          return next err
      tools.addError req, "This mail is already in use: #{email}"
      return res.redirect '/registration'
  else
    tools.addError req, "Invalid user mail or password: #{email}"
    return res.redirect '/registration'

#
# POST
# Local authenticate
#
exports.local = (passport) ->
  return (req, res, next) ->
    passport.authenticate('local', (err, user, info) ->
      return res.send info unless user
      req.logIn user, ->
        return res.send 'OK'
    )(req, res)

#
# GET
# Link authenticate
#
exports.hash = (passport) ->
  return passport.authenticate 'hash',
    failureRedirect: '/'
    failureFlash: true

#
# GET
# Google authenticate
#
exports.google = (passport) ->
  return passport.authenticate 'google',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile'
      'https://www.googleapis.com/auth/userinfo.email'
    ]

#
# GET
#Google authentication callback
#
exports.googleCb = (passport) ->
  return passport.authenticate 'google', failureRedirect: '/'

#
# POST
# Google connect
#
exports.connectGoogle = (req, res, next) ->
  return res.redirect "https://accounts.google.com/o/oauth2/auth?
  client_id=#{cfg.GOOGLE_CLIENT_ID}&
  response_type=code& scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.profile" #&access_type=offline'

#
# GET
# Google connect callback
#
exports.connectGoogleCb = (req, res) ->
  code = req.query['code']
  tokenURL = 'https://accounts.google.com/o/oauth2/token'
  oauth =
    code: code
    client_id: cfg.GOOGLE_CLIENT_ID
    client_secret: cfg.GOOGLE_CLIENT_SECRET
    redirect_uri: 'http://localhost/connect/google/callback'
    grant_type: 'authorization_code'
  return request.post(tokenURL, (error, response, body) ->
    if not error and response.statusCode is 200
      ans = JSON.parse body
      return db.auth.connect req.user.id, 'google', ans.access_token, (err, val) ->
        return res.redirect '/dev/conns'
    return res.redirect '/dev/conns'
  ).form(oauth)

#
# GET
# Facebook authenticate
#
exports.facebook = (passport) ->
  return passport.authenticate 'facebook',
    scope: [
      'email'
      'offline_access'
      'user_status'
      'user_checkins'
      'user_photos'
      'user_videos'
    ]

#
# GET
# Facebook authentication callback
#
exports.facebookCb = (passport) ->
  return passport.authenticate 'facebook', failureRedirect: '/'

#
# POST
# Facebook connect
#
exports.connectFacebook = (req, res, next) ->
  return res.redirect "https://graph.facebook.com/oauth/authorize?
  client_id=#{cfg.FACEBOOK_APP_ID}&
  redirect_uri=http%3A%2F%2Flocalhost/connect/facebook/callback&
  scope=email,user_online_presence"

#
# GET
# Facebook connect callback
#
exports.connectFacebookCb = (req, res) ->
  code = req.query['code']
  tokenURL = "https://graph.facebook.com/oauth/access_token?
  client_id=#{cfg.FACEBOOK_APP_ID}
  &redirect_uri=http%3A%2F%2Flocalhost/connect/facebook/callback
  &client_secret=#{cfg.FACEBOOK_APP_SECRET}
  &code=#{code}"
  return request tokenURL, (error, response, body) ->
    if not error and response.statusCode is 200
      ans = qs.parse body
      return db.auth.connect req.user.id, 'facebook', ans.access_token, (err, val) ->
        return res.redirect '/dev/conns'
    return res.redirect '/dev/conns'

#
# GET
# LinkedIn authenticate
#
exports.linkedin = (passport) ->
  return passport.authenticate 'linkedin'

#
# GET
# LinkedIn authentication callback
#
exports.linkedinCb = (passport) ->
  return passport.authenticate 'linkedin', failureRedirect: '/'

exports.connectLinkedin = (req, res) ->
  oauth =
    callback: 'http://localhost/connect/linkedin/callback/'
    consumer_key: cfg.LINKEDIN_CONSUMER_KEY
    consumer_secret: cfg.LINKEDIN_CONSUMER_SECRET
  url = '   https://api.linkedin.com/uas/oauth/requestToken?scope=r_basicprofile+r_emailaddress'
  return request.post url: url, oauth: oauth, (error, responce, body) ->
    if not error and responce.statusCode is 200
      ans = qs.parse body
      res.redirect ans.xoauth_request_auth_url + '?oauth_token=' + ans.oauth_token

exports.connectLinkedinCb = (req, res) ->
  token = req.query['oauth_token']
  verifier = req.query['oauth_verifier']
  return db.auth.connect req.user.id, 'linkedin', token, (err, val) ->
    return res.redirect('/dev/conns')

exports.connectDropbox = (req, res) ->
  oauth =
    callback: 'http://localhost/connect/dropbox/callback/'
    consumer_key: cfg.DROPBOX_APP_KEY
    consumer_secret: cfg.DROPBOX_APP_SECRET
  url = 'https://api.dropbox.com/1/oauth/request_token'
  return request.post url: url, oauth: oauth, (error, responce, body) ->
    if not error and responce.statusCode is 200
      ans = qs.parse body
      res.redirect "https://www.dropbox.com/1/oauth/authorize?oauth_token=
      #{ans.oauth_token}
      &oauth_callback=http://localhost/connect/dropbox/callback"

exports.connectDropboxCb = (req, res) ->
  token = req.query['oauth_token']
  uid = req.query['uid']
  return db.auth.connect req.user.id, 'dropbox', token, (err, val) ->
    return res.redirect '/dev/conns'

# Yahoo does not support localhost
exports.connectYahoo = (req, res) ->
  oauth =
    callback: 'http://localhost/connect/linkedin/callback/'
    consumer_key: cfg.YAHOO_CONSUMER_KEY
    consumer_secret: cfg.YAHOO_CONSUMER_SECRET
  url = 'https://api.login.yahoo.com/oauth/v2/get_request_token'
  return request.post url: url, oauth: oauth, (error, responce, body) ->
    if not error and responce.statusCode is 200
      ans = qs.parse body
      res.redirect ans.xoauth_request_auth_url + '?oauth_token=' + ans.oauth_token

exports.connectYahooCb = (req, res) ->
  token = req.query['oauth_token']
  verifier = req.query['oauth_verifier']
  return db.auth.connect req.user.id, 'dropbox', token, (err, val) ->
    return res.redirect '/dev/conns'

#
# POST
# Disconnect side service
#
exports.disconnect = (req, res) ->
  db.auth.disconnect req.user.id, req.body.provider, (err) ->
    tools.returnStatus err, res

#
# GET
# Registration confirm
#
exports.confirm = (req, res, next) ->
  id = req.user.id
  return db.users.findById id, (err, user) ->
    if err
      req.flash 'error', 'Problem while registring user'
      return res.redirect '/'
    return db.users.persist user, next

#
# GET
# Redirect to main page
#
exports.logIn = (req, res) ->
  res.redirect '/'

#
# GET
# Logout
#
exports.logOut = (req, res) ->
  req.logOut()
  res.redirect '/'
