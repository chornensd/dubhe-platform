namespace Dubhe.Domain.Auth;

public enum DeviceType
{
    Unknown = 0,
    Pc = 1,
    Mobile = 2
}

public enum AccountStatus
{
    PendingReview = 0,
    Active = 1,
    Rejected = 2,
    Frozen = 3
}

public enum UserType
{
    IndividualCustomer = 1,
    EnterpriseCustomer = 2,
    Merchant = 3,
    MerchantStaff = 4,
    PlatformAdmin = 5,
    AirTrafficController = 6,
    OperationsStaff = 7,
    Pilot = 8,
    PublicUser = 9
}
