import 'dotenv/config';
import { db, testConnection, closeConnection } from '../src/db/index.js';
import { competitors } from '../src/db/schema.js';
import { createLogger } from '../src/utils/logger.js';

const log = createLogger('InitDb');

async function init() {
    try {
        log.info('Initializing database...');

        await testConnection();

        // Seed competitors if empty
        const allCompetitors = await db.select().from(competitors);

        if (allCompetitors.length === 0) {
            log.info('No competitors found. Seeding initial data...');
            await db.insert(competitors).values([
                {
                    name: 'The Standard Hua Hin',
                    facebookPageId: '106316827850849',
                    facebookPageUrl: 'https://www.facebook.com/thestandardhuahin',
                    adsLibraryUrl: 'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=TH&view_all_page_id=106316827850849',
                    category: 'hotel',
                    priceTier: 'luxury',
                    isCustomer: true,
                },
                {
                    name: 'V Villas Hua Hin',
                    facebookPageId: '127395057319',
                    facebookPageUrl: 'https://www.facebook.com/vvillashuahin',
                    adsLibraryUrl: 'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=TH&view_all_page_id=127395057319',
                    category: 'hotel',
                    priceTier: 'luxury',
                },
                {
                    name: 'SO/ Hua Hin',
                    facebookPageId: '1661605707455822',
                    facebookPageUrl: 'https://www.facebook.com/sohuahin',
                    adsLibraryUrl: 'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=TH&view_all_page_id=1661605707455822',
                    category: 'hotel',
                    priceTier: 'luxury',
                }
            ]);
            log.info('Successfully seeded 3 competitors.');
        } else {
            log.info(`Database already contains ${allCompetitors.length} competitors. Skipping seed.`);
        }

        log.info('Database initialization complete.');
    } catch (err) {
        log.error('Database initialization failed', { error: err instanceof Error ? err.message : String(err) });
        process.exitCode = 1;
    } finally {
        await closeConnection();
    }
}

init();
