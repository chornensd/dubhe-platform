using Dubhe.Infrastructure.Auth;

namespace Dubhe.Tests.Auth;

public class PasswordHasherTests
{
    private readonly PasswordHasher _hasher = new();

    [Fact]
    public void Hash_Then_Verify_Should_Succeed()
    {
        var sample = "S3cure!Sample";
        var hash = _hasher.Hash(sample);

        Assert.NotEqual(sample, hash);
        Assert.True(_hasher.Verify(sample, hash));
    }

    [Fact]
    public void Verify_WrongPassword_Should_Fail()
    {
        var hash = _hasher.Hash("Password1");

        Assert.False(_hasher.Verify("Password2", hash));
    }

    [Fact]
    public void Verify_InvalidHash_Should_Fail()
    {
        Assert.False(_hasher.Verify("whatever", "not-a-valid-bcrypt-hash"));
    }
}
