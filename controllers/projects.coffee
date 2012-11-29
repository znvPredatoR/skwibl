db = require '../db'

tools = require '../tools'

#
# GET
# Get all projects
#
exports.index = (req, res, next) ->
  db.projects.get req.user.id, (err, projects) ->
    unless err
      return res.render 'index',
        template: 'projects/index'
        projects: projects
    return next err

#
# GET
# Enter the project
#
exports.show = (req, res, next) ->
  db.projects.set req.user.id, req.params.pid, ->
    db.projects.getData req.params.pid, (err, project) ->
      return next(err) if err

      return db.canvases.index req.params.pid, (err, canvases) ->
        return next(err) if err

        return res.render 'index',
          template: 'projects/show'
          pid: req.params.pid
          canvases: canvases,
          project: project

#
# GET
# Show new project page.
#
exports.new = (req, res) ->
  return res.render 'index', template: 'projects/new'

#
# POST
# Add new project
#
exports.add = (req, res) ->
  if not req.body.name or req.body.name is ''
    tools.addError req, 'Please, enter project name.', 'projectName'
    return res.redirect '/projects/new'
  db.projects.add req.user.id, req.body.name, (err, project) ->
    unless err
      if req.body.inviteeEmails
        return db.projects.inviteEmail project.id, req.user.id, req.body.inviteeEmails, (err, user) ->
          if err
            req.flash 'warning', 'Project was created but there was some problems with sending invites.'
          else
            req.flash 'message', 'Project was created invites were sent.'
          return res.redirect '/projects'
      req.flash 'message', 'Project was created'
      return res.redirect '/projects'
    return res.redirect '/projects/new'

#
# POST
# Close project
#
exports.close = (req, res) ->
  db.projects.setProperties req.body.pid,
    status: 'closed'
    end: new Date
  , (err) ->
    tools.returnStatus err, res

#
# POST
# Reopen project
#
exports.reopen = (req, res) ->
  db.projects.setProperties req.body.pid,
    status: 'reopened'
  , (err) ->
    tools.returnStatus err, res

#
# POST
# Delete project
#
exports.delete = (req, res) ->
  db.projects.delete req.body.pid, (err) ->
    tools.returnStatus err, res

#
# POST
# Invite user to a project
#
exports.invite = (req, res) ->
  data = req.body
  db.projects.inviteEmail data.pid, req.user.id, data.email, (err, user) ->
    return tools.sendError res, err if err
    unless user
      return res.send
        msg: "We have not found the user in our
                database, but the invitation was sent to
                his email."
    return db.users.persist user, ->
      db.projects.getData data.pid, (err, project) ->
        unless err
          return res.send
            msg: "Invitation has been sent."
        return res.send no

#
# GET
# show project participants
#
exports.participants = (req, res) ->
  db.projects.getData req.params.pid, (err, project) ->
    unless err
      return res.render './projects/invite/participants.ect',
        project: project
    res.send no

#
# POST
# Invite user to a project from social network
#
exports.inviteSocial = (req, res) ->
  data = req.body
  db.projects.inviteSocial data.pid, data.provider, data.providerId, (err) ->
    tools.returnStatus err, res

#
# POST
# Invite user to a project by link
#
exports.inviteLink = (req, res) ->
  db.projects.inviteLink req.body.pid, (err) ->
    tools.returnStatus err, res

#
# POST
# Confirm user invitation to a project
#
exports.confirm = (req, res) ->
  data = req.body
  return db.projects.confirm data.aid, req.user.id, data.answer, (err) ->
    return res.send yes if err
    return db.activities.getDataActivity data.aid, (err, activity) ->
      return res.send yes if err
      return res.render './activities/activity',
        activity: activity

#
# POST
# Remove user from a project
#
exports.remove = (req, res) ->
  data = req.body
  if req.user.id isnt data.id
    return db.projects.remove data.pid, data.id, (err) ->
      return res.send no if err
      return res.send uid: data.id
  return res.send no
