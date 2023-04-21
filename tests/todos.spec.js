import test from 'ava'
import supertest from 'supertest'
import { app } from '../src/app.js'
import {createUser, db} from '../src/database.js'

test.beforeEach(async () => {
  await db.migrate.latest()
})

test.afterEach(async () => {
  await db.migrate.rollback()
})

test.serial('GET / shows title of the application', async (t) => {
  const response = await supertest(app).get('/')

  t.assert(response.text.includes('<h1>ToDos!</h1>'))
})

test.serial('GET / shows list of todos', async (t) => {
  await db('todos').insert({ title: 'Test todo!!!' })

  const response = await supertest(app).get('/')

  t.assert(response.text.includes('Test todo!!!'))
})

test.serial('GET / shows list of todos including privates', async (t) => {
  const user = await createUser('username', 'password')
  await db('todos').insert({ title: 'Test todo!!!', user_id: user.id })

  let response = await supertest(app).get('/')

  t.assert(!response.text.includes('Test todo!!!'))

  response = await supertest(app).get('/').set('Cookie', [`token=${user.token}`])

  t.assert(response.text.includes('Test todo!!!'))

  const anotherUser = await createUser('username2', 'password')

  response = await supertest(app).get('/').set('Cookie', [`token=${anotherUser.token}`])

  t.assert(!response.text.includes('Test todo!!!'))
})

test.serial('GET / shows private checkbox for logged users', async (t) => {
  const user = await createUser('username', 'password')

  const response = await supertest(app).get('/').set('Cookie', [`token=${user.token}`])

  t.assert(response.text.includes('soukrome'))
})

test.serial('POST /new-todo creates new todo', async (t) => {
  const response = await supertest(app)
    .post('/new-todo')
    .type('form')
    .send({ title: 'Test todo from form' })
    .redirects(1)

  t.assert(response.text.includes('Test todo from form'))
})

test.serial('POST /new-todo checks auth for private todo', async (t) => {
  const response = await supertest(app)
      .post('/new-todo')
      .type('form')
      .send({ title: 'Test todo from form', 'private': true })
      .redirects(1)

  t.assert(response.status === 401)
  t.assert(response.text.includes('Pro vytvoření soukromého todočka se musíte přihlásit'))
})

test.serial('POST /new-todo creates new private todo', async (t) => {
  const user = await createUser('username', 'password')
  const response = await supertest(app)
      .post('/new-todo')
      .set('Cookie', [`token=${user.token}`])
      .type('form')
      .send({ title: 'Test todo from form', 'private': true })
      .redirects(1)

  t.assert(response.text.includes('Test todo from form'))
})

test.serial('GET /detail-todo/:id shows detail of private todo', async (t) => {
  const user = await createUser('username', 'password')
  const [id] = await db('todos').insert({ title: 'Test todo!!!', user_id: user.id })

  // Check that todo exists
  let response = await supertest(app).get(`/detail-todo/${id}`).set('Cookie', [`token=${user.token}`])

  t.assert(response.text.includes('Test todo!!!'))

  // Check without auth
  response = await supertest(app).get(`/detail-todo/${id}`)

  t.assert(response.status === 401)
  t.assert(response.text.includes('Pro zobrazení detailu todočka se musíte přihlásit'))

  const anotherUser = await createUser('username2', 'password')

  // Check with wrong auth
  response = await supertest(app).get(`/detail-todo/${id}`).set('Cookie', [`token=${anotherUser.token}`])

  t.assert(response.status === 401)
  t.assert(response.text.includes('Nemůžete zobrazit detail todočka, které není vaše'))
})

test.serial('POST /update-todo/:id updates todo', async (t) => {
  const [id] = await db('todos').insert({ title: 'Test todo!!!' })

  const firstResponse = await supertest(app).get(`/detail-todo/${id}`)

  t.assert(firstResponse.text.includes('Test todo!!!'))

  const secondResponse = await supertest(app)
    .post(`/update-todo/${id}`)
    .type('form')
    .send({ title: 'New title!!!' })
    .redirects(1)

  t.assert(!secondResponse.text.includes('Test todo!!!'))
  t.assert(secondResponse.text.includes('New title!!!'))
})

test.serial('POST /update-todo/:id updates private todo', async (t) => {
  const user = await createUser('username', 'password')
  const [id] = await db('todos').insert({ title: 'Test todo!!!', user_id: user.id })

  // Check that todo exists
  let response = await supertest(app).get(`/detail-todo/${id}`).set('Cookie', [`token=${user.token}`])

  t.assert(response.text.includes('Test todo!!!'))

  // Update todo without auth
  response = await supertest(app)
    .post(`/update-todo/${id}`)
    .type('form')
    .send({ title: 'New title!!!' })
    .redirects(1)

  t.assert(response.status === 401)
  t.assert(response.text.includes('Pro změnu todočka se musíte přihlásit'))

  const anotherUser = await createUser('username2', 'password')

  // Update todo with wrong auth
  response = await supertest(app)
    .post(`/update-todo/${id}`)
    .set('Cookie', [`token=${anotherUser.token}`])
    .type('form')
    .send({ title: 'New title!!!' })
    .redirects(1)

  t.assert(response.status === 401)
  t.assert(response.text.includes('Nemůžete změnit todočko, které není vaše'))

  // Update todo with correct auth
  response = await supertest(app)
    .post(`/update-todo/${id}`)
    .set('Cookie', [`token=${user.token}`])
    .type('form')
    .send({ title: 'New title!!!' })
    .redirects(1)

  t.assert(!response.text.includes('Test todo!!!'))
  t.assert(response.text.includes('New title!!!'))
})

test.serial('GET /toggle-todo/:id toggles todo on index', async (t) => {
  const [id] = await db('todos').insert({ title: 'Test todo!!!' })

  const firstResponse = await supertest(app).get('/')

  t.assert(firstResponse.text.includes('Nesplněno'))
  t.assert(!firstResponse.text.includes('Hotovo'))

  const secondResponse = await supertest(app).get(`/toggle-todo/${id}`).set('Referer', '/').redirects(1)

  t.assert(secondResponse.text.includes('Hotovo'))
  t.assert(!secondResponse.text.includes('Nesplněno'))
})

test.serial('GET /toggle-todo/:id toggles private todo on index', async (t) => {
  const user = await createUser('username', 'password')
  const [id] = await db('todos').insert({ title: 'Test todo!!!', user_id: user.id })

  // Check that todo exists
  let response = await supertest(app).get('/').set('Cookie', [`token=${user.token}`])

  t.assert(response.text.includes('Nesplněno'))
  t.assert(!response.text.includes('Hotovo'))

  // Toggle todo without auth
  response = await supertest(app).get(`/toggle-todo/${id}`).set('Referer', '/').redirects(1)
  t.assert(response.status === 401)
  t.assert(response.text.includes('Pro změnu stavu todočka se musíte přihlásit'))

  const anotherUser = await createUser('username2', 'password')

  // Toggle todo with another user
  response = await supertest(app).get(`/toggle-todo/${id}`).set('Cookie', [`token=${anotherUser.token}`]).set('Referer', '/').redirects(1)

  t.assert(response.status === 401)
  t.assert(response.text.includes('Nemůžete změnit stav todočka, které není vaše'))

  // Toggle todo with correct user
  response = await supertest(app).get(`/toggle-todo/${id}`).set('Referer', '/').set('Cookie', [`token=${user.token}`]).redirects(1)

  t.assert(response.text.includes('Hotovo'))
  t.assert(!response.text.includes('Nesplněno'))
})

test.serial('GET /toggle-todo/:id toggles todo on detail', async (t) => {
  const [id] = await db('todos').insert({ title: 'Test todo!!!' })

  const firstResponse = await supertest(app).get(`/detail-todo/${id}`)

  t.assert(firstResponse.text.includes('Nesplněno'))
  t.assert(!firstResponse.text.includes('Hotovo'))

  const secondResponse = await supertest(app)
    .get(`/toggle-todo/${id}`)
    .set('Referer', `/detail-todo/${id}`)
    .redirects(1)

  t.assert(secondResponse.text.includes('Hotovo'))
  t.assert(!secondResponse.text.includes('Nesplněno'))
})

test.serial('GET /remove-todo/:id deletes todo', async (t) => {
  const [id] = await db('todos').insert({ title: 'Test todo!!!' })

  const firstResponse = await supertest(app).get('/')

  t.assert(firstResponse.text.includes('Test todo!!!'))

  const secondResponse = await supertest(app).get(`/remove-todo/${id}`).set('Referer', '/').redirects(1)

  t.assert(!secondResponse.text.includes('Test todo!!!'))
})

test.serial('GET /remove-todo/:id deletes private todo', async (t) => {
  const user = await createUser('username', 'password')
  const [id] = await db('todos').insert({ title: 'Test todo!!!', user_id: user.id })

  // Check that todo exists
  let response = await supertest(app).get('/').set('Cookie', [`token=${user.token}`])

  t.assert(response.text.includes('Test todo!!!'))

  // Try to remove it without auth
  response = await supertest(app).get(`/remove-todo/${id}`).set('Referer', '/').redirects(1)

  t.assert(response.status === 401)
  t.assert(response.text.includes('Pro smazání soukromého todočka se musíte přihlásit'))

  const anotherUser = await createUser('username2', 'password')

  // Try to remove it with another user
  response = await supertest(app).get(`/remove-todo/${id}`).set('Referer', '/').set('Cookie', [`token=${anotherUser.token}`]).redirects(1)

  t.assert(response.status === 401)
  t.assert(response.text.includes('Nemůžete smazat todočko, které není vaše'))

  // Remove it with auth
  response = await supertest(app).get(`/remove-todo/${id}`).set('Referer', '/').set('Cookie', [`token=${user.token}`]).redirects(1)

  t.assert(!response.text.includes('Test todo!!!'))
})

test.serial('POST /new-todo shows error message for empty title', async (t) => {
  const response = await supertest(app).post('/new-todo').type('form').send({ title: '' })

  t.assert(response.text.includes('Zadejte název todočka!'))
})

test.serial('POST /new-todo shows error message for title with multiple spaces', async (t) => {
  const response = await supertest(app).post('/new-todo').type('form').send({ title: '   ' })

  t.assert(response.text.includes('Zadejte název todočka!'))
})
