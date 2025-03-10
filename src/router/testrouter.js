import { Router } from 'express'

const router = Router()

router.get('/', (req, res) => {
  res.send('Test router root')
})

router.get('/example', (req, res) => {
  res.send('Test router example route')
})

export default router
