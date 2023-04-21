import express from 'express'
import cookieParser from 'cookie-parser'
import {createUser, db, getUserByPassword, getUserByToken} from './database.js'
import { sendTodoDeletedToAllConnections, sendTodoToAllConnections, sendTodosToAllConnections } from './websockets.js'

export const app = express()

app.set('view engine', 'ejs')

app.use(express.static('public'))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

app.use(async (req, res, next) => {
  const token = req.cookies.token

  if (token) {
    res.locals.user = await getUserByToken(token)
  } else {
    res.locals.user = null
  }

  next()
})

const requiresAuth = (req, res, next) => {
  if (res.locals.user) {
    next()
  } else {
    res.redirect('/register')
  }
}

app.get('/', async (req, res) => {
  const query = db('todos').select('*')

  if (req.query.done) {
    query.where('done', req.query.done === 'true')
  }

  const todos = await query

  return res.render('index', {
    todos: todos,
  })
})

app.post('/new-todo', async (req, res) => {
  const newTodo = {
    title: (req.body.title || '').trim(),
    deadline: req.body.deadline || null,
  }

  if (!newTodo.title) {
    return res.status(400).render('400', {
      error: 'Zadejte název todočka!',
    })
  }

  await db('todos').insert(newTodo)

  sendTodosToAllConnections()

  res.redirect('/')
})

app.get('/remove-todo/:id', async (req, res) => {
  const idToRemove = Number(req.params.id)

  await db('todos').delete().where('id', idToRemove)

  sendTodosToAllConnections()
  sendTodoDeletedToAllConnections(idToRemove)

  res.redirect('/')
})

app.get('/toggle-todo/:id', async (req, res, next) => {
  const idToToggle = Number(req.params.id)

  const todoToToggle = await db('todos').select('*').where('id', idToToggle).first()

  if (!todoToToggle) return next()

  await db('todos').update({ done: !todoToToggle.done }).where('id', idToToggle)

  sendTodosToAllConnections()
  sendTodoToAllConnections(idToToggle)

  res.redirect('back')
})

app.get('/detail-todo/:id', async (req, res, next) => {
  const idToShow = Number(req.params.id)

  const todoToShow = await db('todos').select('*').where('id', idToShow).first()

  if (!todoToShow) return next()

  res.render('detail', {
    todo: todoToShow,
  })
})

app.post('/update-todo/:id', async (req, res, next) => {
  const idToUpdate = Number(req.params.id)
  const newTitle = String(req.body.title)

  const todoToUpdate = await db('todos').select('*').where('id', idToUpdate).first()

  if (!todoToUpdate) return next()

  await db('todos').update({ title: newTitle }).where('id', idToUpdate)

  sendTodosToAllConnections()
  sendTodoToAllConnections(idToUpdate)

  res.redirect('back')
})

app.get('/register', (req, res) => {
  res.render('register')
})

app.post('/register', async (req, res) => {
  const user = await createUser(req.body.username, req.body.password)

  res.cookie('token', user.token)

  res.redirect('/')
})

app.get('/logout', (req, res) => {
  res.cookie('token', undefined)

  res.redirect('/')
})

app.get('/login', (req, res) => {
  res.render('login')
})

app.post('/login', async (req, res) => {
  const user = await getUserByPassword(req.body.username, req.body.password)

    if (!user) {
      return res.status(401).render('login', {
          error: 'Nesprávné jméno nebo heslo!',
      })
    }

  res.cookie('token', user.token)

  res.redirect('/')
})

app.use((req, res) => {
  res.status(404).render('404')
})
