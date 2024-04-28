// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @author Dmytro Vyshnevskyi
 * @title Domain Registry with Rewards
 * @notice Enhanced domain registry system with rewards linked to domain registrations
 */
 
contract DomainRegistry is Initializable {
    address public owner;
    uint256 public registrationFee;
    mapping(string => address) private domainControllers;
    mapping(string => uint256) private domainRewards;
    mapping(string => string) private parentDomains;

    error OnlyOwner();
    error IncorrectRegistrationFee();
    error DomainAlreadyRegistered();
    error DomainNotRegistered();
    error InvalidInput();
    error OnlyController();

    event DomainRegistered(string domain, address indexed controller);
    event RegistrationFeeChanged(uint256 newFee);
    event RewardIssued(
        string domain,
        address indexed beneficiary,
        uint256 reward
    );

    function initialize() external initializer {
        owner = msg.sender;
        registrationFee = 1 ether;
    }

    /**
     * @notice Ensures only the owner can perform certain actions
     */
    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    /**
     * @notice Registers a new domain
     * @param domain The domain to be registered
     * @param parentDomain The parent domain, if any
     */
    function registerDomain(
    string calldata domain,
    string calldata parentDomain
) external payable {
    if (msg.value < registrationFee) revert IncorrectRegistrationFee();
    if (domainControllers[domain] != address(0)) revert DomainAlreadyRegistered();
    if (bytes(domain).length == 0) revert InvalidInput();
    if (bytes(parentDomain).length != 0 && domainControllers[parentDomain] == address(0)) {
        revert DomainNotRegistered();
    }

    address parentController = domainControllers[parentDomain];
    if (parentController == address(0) && bytes(parentDomain).length != 0) {
        revert InvalidInput();
    }

    uint256 reward = 0;
    if (bytes(parentDomain).length != 0) {
        reward = domainRewards[parentDomain];
    }

    domainControllers[domain] = msg.sender;
    parentDomains[domain] = parentDomain;
    domainRewards[domain] = 0; 
    emit DomainRegistered(domain, msg.sender);

    if (reward > 0) {
        payable(parentController).transfer(reward);
        emit RewardIssued(parentDomain, parentController, reward);
    }
}


    /**
     * @notice Sets the reward for a domain
     * @param domain The domain name
     * @param reward The reward amount
     */
    function setDomainReward(string calldata domain, uint256 reward) external {
        if (domainControllers[domain] != msg.sender) revert OnlyController();
        domainRewards[domain] = reward;
    }

    /**
     * @notice Changes the registration fee
     * @param newFee The new registration fee
     */
    function changeRegistrationFee(uint256 newFee) external onlyOwner {
        registrationFee = newFee;
        emit RegistrationFeeChanged(newFee);
    }

    /**
     * @notice Retrieves domain controller address
     * @param domain The domain in question
     * @return The domain's controller address
     */
    function getDomainController(
        string calldata domain
    ) external view returns (address) {
        address controller = domainControllers[domain];
        if (controller == address(0)) revert DomainNotRegistered();
        return controller;
    }

    /**
     * @notice Retrieves domain reward
     * @param domain The domain in question
     * @return The domain's reward amount
     */
    function getDomainReward(
        string calldata domain
    ) external view returns (uint256) {
        return domainRewards[domain];
    }
}