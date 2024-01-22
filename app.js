const express = require('express')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const path = require('path')
const app = express()
const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
app.use(express.json())

// initializing DB and connect Server...
let db = null
const initializeAndConnectDB = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () =>
      console.log('Server Running at http://localhost:3000/'),
    )
  } catch (err) {
    console.log(`DB ERROR: ${err.message}`)
    process.exit(1)
  }
}
initializeAndConnectDB()

// Authentication with token
const authenticateToken = (request, response, next) => {
  const authHeader = request.headers['authorization']
  let jwtToken
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'ItsPrasanthPassword', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

//Login User API (API 1)

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const payload = {username}
  const getProfileQuery = `
  SELECT 
  *
  FROM 
  user
  WHERE username = '${username}';`
  const dbUser = await db.get(getProfileQuery)

  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password)

    if (isPasswordMatched === true) {
      const jwtToken = await jwt.sign(payload, 'ItsPrasanthPassword')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

// Returns a list of all states in the state table (API 2)

app.get('/states/', authenticateToken, async (request, response) => {
  const getStatesQuery = `
  SELECT 
  state_id as stateId,state_name as stateName,population 
  FROM 
  state;`

  const stateList = await db.all(getStatesQuery)
  response.send(stateList)
})

// Returns a state based on the state ID

app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const getStateQuery = `
  SELECT 
  state_id as stateId,state_name as stateName,population 
  FROM 
  state 
  WHERE state_id = ${stateId};`

  const state = await db.all(getStateQuery)
  response.send(state[0])
})

//Create a district in the district table, `district_id` is auto-incremented

app.post('/districts/', authenticateToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body

  const createDistrictQuery = `
  INSERT INTO
  district(district_name,
  state_id,cases,cured,
  active,deaths)
  values ("${districtName}",
  ${stateId},
  ${cases},
  ${cured},
  ${active},
  ${deaths});`

  await db.run(createDistrictQuery)
  response.send('District Successfully Added')
})

// Returns a district based on the district ID

app.get(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const getDistrictQuery = `
    SELECT district_id as districtId,
    district_name as districtName,
    state_id as stateId,
    cases,cured,active,deaths
    FROM
    district 
    WHERE district_id = ${districtId}`

    const district = await db.get(getDistrictQuery)
    response.send(district)
  },
)

// Deletes a district from the district table based on the district ID

app.delete(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const getDistrictQuery = `
    DELETE 
    FROM
    district 
    WHERE district_id = ${districtId}`

    await db.get(getDistrictQuery)
    response.send('District Removed')
  },
)

// Updates the details of a specific district based on the district ID

app.put(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const updateDistrictQuery = `
    UPDATE
    district
    SET 
    district_name = "${districtName}",
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths}
    WHERE district_id = ${districtId};`

    await db.run(updateDistrictQuery)
    response.send('District Details Updated')
  },
)

// Returns the statistics of total cases, cured, active, deaths of a specific state based on state ID

app.get(
  '/states/:stateId/stats/',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const getStatisticsQuery = `
    SELECT SUM(cases) as totalCases,
    SUM(cured) as totalCured,
    SUM(active) as totalActive,
    SUM(deaths) as totalDeaths
    FROM
    district 
    WHERE state_id = ${stateId}`

    const statistics = await db.get(getStatisticsQuery)
    response.send(statistics)
  },
)

module.exports = app
