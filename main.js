import express from 'express'

const app = express()

app.set('view engine', 'ejs')

app.use(express.urlencoded({ extended: true }))

let todos = [
  {
    id: Math.random(),
    title: 'Nakoupit jídlo',
    done: false,
  },
  {
    id: Math.random(),
    title: 'Nakoupit pivo',
    done: true,
  },
]

app.get('/', (req, res) => {
  res.render('index', {
    name: 'Adam',
    todos: todos,
  })
})

app.get('/todo/:id', (req, res) => {
  const id = Number(req.params.id)
  const todo = todos.filter((todo) => todo.id === id)[0]

  if(!todo) {
    res.render('404')
    return
  }

  res.render('detail', {
    todo
  })
})

app.post('/todo/:id', (req, res) => {
  const id = Number(req.params.id)
  const title = req.body.title
  const todo = todos.filter((todo) => todo.id === id)[0]

  todo.title = title

  const redirect = req.query.redirect
  if(redirect === 'detail') {
    res.redirect(`/todo/${todo.id}`)
    return
  }

  res.redirect('/')
})

app.post('/new-todo', (req, res) => {
  const newTodo = {
    id: Math.random(),
    title: req.body.title,
    done: false,
  }

  todos.push(newTodo)

  res.redirect('/')
})

app.get('/remove-todo/:id', (req, res) => {
  const idToRemove = Number(req.params.id)

  todos = todos.filter((todo) => todo.id !== idToRemove)

  res.redirect('/')
})

app.get('/toggle-todo/:id', (req, res) => {
  const idToToggle = Number(req.params.id)

  const todo = todos.find((todo) => todo.id === idToToggle)

  todo.done = !todo.done

  const redirect = req.query.redirect
  if(redirect === 'detail') {
    res.redirect(`/todo/${todo.id}`)
    return
  }

  res.redirect('/')
})

app.listen(3000, () => {
  console.log('App listening on port 3000')
})
