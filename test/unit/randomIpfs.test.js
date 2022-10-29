const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Random IPFS NFT Unit Tests", function () {
        let randomIpfsNFT, deployer, vrfCoordinatorV2Mock

        beforeEach(async () => {
            accounts = await ethers.getSigners()
            deployer = accounts[0]
            await deployments.fixture(["mocks", "randomipfs"])
            randomIpfsNFT = await ethers.getContract("RandomIpfsNFT")
            vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        })

        describe("constructor", () => {
            it("sets starting values correctly", async function () {
                const dogTokenUriZero = await randomIpfsNFT.getDogTokenUris(0)
                const isInitialized = await randomIpfsNFT.getInitialized()
                assert(dogTokenUriZero.includes("ipfs://"))
                assert.equal(isInitialized, true)
            })
        })

        describe("requestNFT", () => {
            it("fails if payment isn't sent with the request", async function () {
                await expect(randomIpfsNFT.requestNFT()).to.be.revertedWith(
                    "RandomIpfsNFT__NeedMoreETHSent"
                )
            })
            it("reverts if payment amount is less than the mint fee", async function () {
                const fee = await randomIpfsNFT.getMintFee()
                await expect(
                    randomIpfsNFT.requestNFT({
                        value: fee.sub(ethers.utils.parseEther("0.001")),
                    })
                ).to.be.revertedWith("RandomIpfsNFT__NeedMoreETHSent")
            })
            it("emits an event and kicks off a random word request", async function () {
                const fee = await randomIpfsNFT.getMintFee()
                await expect(randomIpfsNFT.requestNFT({ value: fee.toString() })).to.emit(
                    randomIpfsNFT,
                    "NFTRequested"
                )
            })
        })
        describe("fulfillRandomWords", () => {
            it("mints NFT after random number is returned", async function () {
                await new Promise(async (resolve, reject) => {
                    randomIpfsNFT.once("NFTMinted", async () => {
                        try {
                            const tokenUri = await randomIpfsNFT.tokenURI("0")
                            const tokenCounter = await randomIpfsNFT.getTokenCounter()
                            assert.equal(tokenUri.toString().includes("ipfs://"), true)
                            assert.equal(tokenCounter.toString(), "1")
                            resolve()
                        } catch (e) {
                            console.log(e)
                            reject(e)
                        }
                    })
                    try {
                        const fee = await randomIpfsNFT.getMintFee()
                        const requestNFTResponse = await randomIpfsNFT.requestNFT({
                            value: fee.toString(),
                        })
                        const requestNFTReceipt = await requestNFTResponse.wait(1)
                        await vrfCoordinatorV2Mock.fulfillRandomWords(
                            requestNFTReceipt.events[1].args.requestId,
                            randomIpfsNFT.address
                        )
                    } catch (e) {
                        console.log(e)
                        reject(e)
                    }
                })
            })
        })
        describe("getBreedFromModdedRng", () => {
            it("should return pug if moddedRng < 10", async function () {
                const expectedValue = await randomIpfsNFT.getBreedFromModdedRng(7)
                assert.equal(0, expectedValue)
            })
            it("should return shiba-inu if moddedRng is between 10 - 39", async function () {
                const expectedValue = await randomIpfsNFT.getBreedFromModdedRng(21)
                assert.equal(1, expectedValue)
            })
            it("should return st. bernard if moddedRng is between 40 - 99", async function () {
                const expectedValue = await randomIpfsNFT.getBreedFromModdedRng(77)
                assert.equal(2, expectedValue)
            })
            it("should revert if moddedRng > 99", async function () {
                await expect(randomIpfsNFT.getBreedFromModdedRng(100)).to.be.revertedWith(
                    "RandomIpfsNFT__RangeOutOfBounds"
                )
            })
        })
    })