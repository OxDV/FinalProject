const { ethers } = require('hardhat');
const { expect } = require('chai');
const { upgrades } = require('hardhat');

describe('DomainRegistry', function () {
    let domainRegistry;
    let owner, user1, user2;
    const registrationFee = ethers.parseEther('1');

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();
        const DomainRegistry = await ethers.getContractFactory('DomainRegistry', owner);
        domainRegistry = await upgrades.deployProxy(DomainRegistry, [], { initializer: 'initialize' });
    });

		it('should collect metrics based on DomainRegistered events for top-level domains', async function () {
			// Register top-level domains
			await domainRegistry.connect(user1).registerDomain('com', '', { value: registrationFee });
			await domainRegistry.connect(user2).registerDomain('net', '', { value: registrationFee });
			await domainRegistry.connect(user1).registerDomain('org', '', { value: registrationFee });

			// Filter for all DomainRegistered events
			const allEventsFilter = domainRegistry.filters.DomainRegistered()
			const allEvents = await domainRegistry.queryFilter(allEventsFilter)
	
			// Metrics: Total number of registered top-level domains
			const totalRegisteredDomains = allEvents.length
			console.log(`Total Registered Top-Level Domains: ${totalRegisteredDomains}`)
	
			// List of registered top-level domains sorted by registration date
			const domainsSortedByDate = allEvents
				.sort((a, b) => {
					if (a.args.registrationDate > b.args.registrationDate) {
						return 1
					} else if (a.args.registrationDate < b.args.registrationDate) {
						return -1
					} else {
						return 0
					}
				})
				.map(event => event.args.domain)
			console.log('Top-Level Domains Sorted by Date:', domainsSortedByDate)
	
			// Filter for DomainRegistered events for a specific controller (user1)
			const user1EventsFilter = domainRegistry.filters.DomainRegistered(
				null,
				user1.address
			)
			const user1Events = await domainRegistry.queryFilter(user1EventsFilter)
	
			// List of registered top-level domains by user1, sorted by registration date
			const user1DomainsSortedByDate = user1Events
				.sort((a, b) => {
					if (a.args.registrationDate > b.args.registrationDate) {
						return 1
					} else if (a.args.registrationDate < b.args.registrationDate) {
						return -1
					} else {
						return 0
					}
				})
				.map(event => event.args.domain)
			console.log(
				'User1 Top-Level Domains Sorted by Date:',
				user1DomainsSortedByDate
			)
	
			expect(totalRegisteredDomains).to.be.greaterThan(0)
			expect(domainsSortedByDate).to.deep.equal(['com', 'net', 'org'])
			expect(user1DomainsSortedByDate.length).to.be.greaterThan(0)
		})

    describe('Deployment', function () {
        it('Should set the right owner and registration fee', async function () {
            expect(await domainRegistry.owner()).to.equal(owner.address);
            expect(await domainRegistry.registrationFee()).to.equal(registrationFee);
        });
    });

    describe('Domain Registration', function () {
			it('Should allow a user to register a domain with the correct fee', async function () {
        await expect(
            domainRegistry.connect(user1).registerDomain('example', '', { value: registrationFee })
        ).to.emit(domainRegistry, 'DomainRegistered').withArgs('example', user1.address);
    	});

			it('Should fail to register a domain without the correct fee', async function () {
        await expect(
            domainRegistry.connect(user1).registerDomain('example', '', { value: ethers.parseEther('0.5') })
        ).to.be.revertedWithCustomError(domainRegistry, 'IncorrectRegistrationFee');
    });

		it('Should prevent registering an already registered domain', async function () {
			await domainRegistry.connect(user1).registerDomain('example', '', { value: registrationFee });
			await expect(
					domainRegistry.connect(user2).registerDomain('example', '', { value: registrationFee })
			).to.be.revertedWithCustomError(domainRegistry, 'DomainAlreadyRegistered');
	});

		it('Should register a subdomain and issue a reward if set', async function () {
			await domainRegistry.connect(user1).registerDomain('org', '', { value: registrationFee });
			await domainRegistry.connect(user1).setDomainReward('org', ethers.parseEther('0.1'));
			await expect(
					domainRegistry.connect(user2).registerDomain('test.org', 'org', { value: registrationFee })
			).to.emit(domainRegistry, 'RewardIssued').withArgs('org', user1.address, ethers.parseEther('0.1'));
	});

    });

    describe('Changing Registration Fee', function () {
        it('Should allow the owner to change the registration fee', async function () {
            const newFee = ethers.parseEther('2');
            await domainRegistry.changeRegistrationFee(newFee);
            expect(await domainRegistry.registrationFee()).to.equal(newFee);
        });

        it('Should prevent non-owners from changing the registration fee', async function () {
            const newFee = ethers.parseEther('2');
            await expect(
                domainRegistry.connect(user1).changeRegistrationFee(newFee)
            ).to.be.revertedWithCustomError(domainRegistry, 'OnlyOwner');
        });
    });

    describe('Setting and Retrieving Domain Rewards', function () {
        it('Should allow setting and retrieving domain rewards', async function () {
					await domainRegistry.connect(user1).registerDomain('example', '', { value: registrationFee });
					await domainRegistry.connect(user1).setDomainReward('example', ethers.parseEther('0.05'));
            const reward = await domainRegistry.getDomainReward('example');
            expect(reward).to.equal(ethers.parseEther('0.05'));
        });
    });

    describe('Retrieving Domain Info', function () {
			it('Should return the correct domain info after registration', async function () {
        await domainRegistry.connect(user1).registerDomain('example', '', { value: registrationFee });
        const controller = await domainRegistry.getDomainController('example');
        expect(controller).to.equal(user1.address);
    });

    it('Should fail for unregistered domains', async function () {
        await expect(
            domainRegistry.getDomainController('nonexistent')
        ).to.be.revertedWithCustomError(domainRegistry, 'DomainNotRegistered');
    });
    });
});