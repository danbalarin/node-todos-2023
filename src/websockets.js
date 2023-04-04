import ejs from 'ejs'
import { WebSocketServer, WebSocket } from 'ws'
import { db } from './database.js'

/** @type {Set<WebSocket>} */
const connections = new Set()

export const createWebSocketServer = (server) => {
  const wss = new WebSocketServer({ server })

  wss.on('connection', (ws) => {
    connections.add(ws)

    console.log('New connection', connections.size)

    ws.on('close', () => {
      connections.delete(ws)

      console.log('Closed connection', connections.size)
    })
  })
}

export const sendTodosToAllConnections = async () => {
  try {
    const todos = await db('todos').select('*')

    const html = await ejs.renderFile('views/_todos.ejs', {
      todos,
    })

    const message = {
      type: 'todos',
      html,
    }

    for (const connection of connections) {
      connection.send(JSON.stringify(message))
    }
  } catch (e) {
    console.error(e)
  }
}
