import {createWriteStream, existsSync, readFileSync, unlink, writeFileSync} from 'fs'
import {xsdBoolean, xsdDateTime} from "./util/xsd";

const OUTPUT = './ontologies/holidays.owl'

// Remove file if exists
if (existsSync(OUTPUT)) unlink(OUTPUT, console.warn);

// Copy initial data
const schema = readFileSync('./schemas/holidays.owl', {});
writeFileSync(OUTPUT, schema, {})

const output = createWriteStream(OUTPUT, {flags: 'a'})
const data = JSON.parse(readFileSync('./data/holidays.json').toString());

const regionMap: { [key: string]: string } = {
    'country-wide': ':North, :Center, :South',
    'noord': ':North',
    'midden': ':Center',
    'zuid': ':South'
}

for (const year of data) {
    let {schoolyear, vacations} = year.content[0];
    schoolyear = schoolyear.replace(/ /g, '');

    output.write(`:${schoolyear} rdf:type owl:NamedIndividual, :AcademicYear.\n`);

    for (const holiday of vacations) {
        let {compulsorydates, type} = holiday;

        for (const data of holiday.regions) {
            let {region, startdate, enddate} = data;
            if (region === 'heel Nederland') region = 'country-wide';

            output.write(
                `:${type}-${schoolyear}-${region} rdf:type owl:NamedIndividual, :Holiday;\n` +
                `  :fallsInAcademicYear :${schoolyear};\n` +
                `  :forRegion ${regionMap[region]};\n` +
                `  :isCompulsory ${xsdBoolean(compulsorydates === 'true')};\n` +
                `  :startDate ${xsdDateTime(new Date(startdate))};\n` +
                `  :endDate ${xsdDateTime(new Date(enddate))}.\n`
            );
        }
    }
}