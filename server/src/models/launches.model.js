const axios = require('axios');

const launchesDatabase = require('./launches.mongo')
const planets = require('./planets.mongo')

const DEFAULT_FLIGHT_NUMBER = 100;

const launch ={
    mission : 'Kepler Exploration X',       //name
    rocket : 'Explorer IS1',                             //rockets.name
    launchDate : new Date('December 27. 2030'),     //date_local
    target : 'Kepler-442 b',                        //not applicable
    customers : ['ZTM', 'NASA'],                     //payloads.customers
    upcoming : true,                                //upcoming
    success: true,                                  //success
    flightNumber : 101,                     //flight_number
};

saveLaunch(launch);

const SPACEX_API_URL = 'https://api.spacexdata.com/v4/launches/query';

async function populateLaunches(){
    console.log('Downloading SpaceX Launch Data ...');
    const response = await axios.post(SPACEX_API_URL, {
            query : {},
            options: {
                pagination : false,
                populate : [
                    {
                        path : 'rocket',
                        select: {
                            name : 1
                        }
                    },
                    {
                        path : 'payloads',
                        select: {
                            customers : 1
                        }
                    }
                ]
            }
    });

    if(response.status !== 200){
        console.log('Problem Downloading Launch Data');
        throw new Error('Launch data download failed');
    }

    const launchDocs = response.data.docs;
    for(const launchDoc of launchDocs){
        const payloads = launchDoc['payloads'];
        const customers = payloads.flatMap( (payload) => {
                return payload['customers'];
                console.log('hello');
        });

        const launch = {
            flightNumber : launchDoc['flight_number'],
            mission : launchDoc['name'],
            rocket : launchDoc['rocket']['name'],
            launchDate : launchDoc['date_local'],
            upcoming : launchDoc['upcoming'],
            success : launchDoc['success'],
            customers,
        };

        console.log(`${launch.flightNumber} ${launch.mission}`);

        await saveLaunch(launch);
    }
}

async function loadLaunchData(){
   const firstLaunch =  await findLaunch({
        flightNumber :1,
        rocket : 'Falcon 1',
        mission : 'FalconSat',
    });
    if(firstLaunch){
        console.log('SpaceX launch data already exists!');
    } else{
        await populateLaunches();
    }
}
   

async function findLaunch(filter){
    return await launchesDatabase.findOne(filter);
}

async function existsLaunchWithId(launchId){
    return await findLaunch({
        flightNumber : launchId,
    });
}

async function getLatestFlightNumber(){
    const latestLaunch = await launchesDatabase
        .findOne()
        .sort('-flightNumber');

        if(!latestLaunch){
            return DEFAULT_FLIGHT_NUMBER;
        }

    return latestLaunch.flightNumber;
}

async function getAllLaunches(){
    return await launchesDatabase.
    find({},{ '__v': 0 , '_id' :0 });
}

async function saveLaunch(launch){   
    await launchesDatabase.findOneAndUpdate({
        flightNumber : launch.flightNumber,
    }, launch, {
        upsert: true,
    });
}

async function scheduleNewLaunch(launch){
    const planet = await planets.findOne({
        keplerName : launch.target,
    });

    if(!planet){
        throw new Error('No matching planet found');
    }

    const newFlightNumber = await getLatestFlightNumber() + 1;

    const newLaunch = Object.assign(launch , {
        success : true,
        upcoming : true,
        customers : ['ztm', 'NASA'],
        flightNumber : newFlightNumber,
    });

    await saveLaunch(newLaunch);
}

async function abortLaunchById(launchId){
    const aborted =  await launchesDatabase.updateOne({
        flightNumber : launchId,
    }, {
        upcoming : false,
        success : false,
    });
    return aborted.ok === 1 && aborted.nModified === 1;
}

module.exports = {
    loadLaunchData,
    existsLaunchWithId,
    getAllLaunches,
    scheduleNewLaunch,
    abortLaunchById,
};