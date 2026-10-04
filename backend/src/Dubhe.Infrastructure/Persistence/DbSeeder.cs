using System.Security.Cryptography;
using Dubhe.Application.Abstractions;
using Dubhe.Domain.Auth;
using Dubhe.Domain.Config;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Dubhe.Infrastructure.Persistence;

public static class DbSeeder
{
    public static async Task SeedAsync(
        DubheDbContext db,
        IPasswordHasher passwordHasher,
        IConfiguration configuration,
        ILogger logger,
        CancellationToken ct = default)
    {
        await SeedPermissionsAsync(db, ct);
        await SeedRolesAsync(db, ct);
        await SeedRolePermissionsAsync(db, ct);
        await SeedAdminAsync(db, passwordHasher, configuration, logger, ct);
        await SeedSystemConfigsAsync(db, ct);
    }

    private static async Task SeedSystemConfigsAsync(DubheDbContext db, CancellationToken ct)
    {
        var existing = await db.SystemConfigItems.Select(c => c.Key).ToListAsync(ct);
        var missing = ConfigCatalog.Defaults.Where(c => !existing.Contains(c.Key)).ToList();
        if (missing.Count == 0)
        {
            return;
        }

        db.SystemConfigItems.AddRange(missing.Select(item => new SystemConfigItem
        {
            Key = item.Key,
            Name = item.Name,
            Group = item.Group,
            Value = item.Value,
            ValueType = item.ValueType,
            Description = item.Description
        }));
        await db.SaveChangesAsync(ct);
    }

    private static async Task SeedPermissionsAsync(DubheDbContext db, CancellationToken ct)
    {
        var existing = await db.Permissions.Select(p => p.Code).ToListAsync(ct);
        var missing = PermissionCatalog.All.Where(p => !existing.Contains(p.Code)).ToList();
        if (missing.Count == 0)
        {
            return;
        }

        db.Permissions.AddRange(missing.Select(p => new Permission
        {
            Code = p.Code,
            Name = p.Name,
            Module = p.Module
        }));
        await db.SaveChangesAsync(ct);
    }

    private static async Task SeedRolesAsync(DubheDbContext db, CancellationToken ct)
    {
        var existing = await db.Roles.Select(r => r.Code).ToListAsync(ct);
        var missing = PermissionCatalog.Roles.Where(r => !existing.Contains(r.Code)).ToList();
        if (missing.Count == 0)
        {
            return;
        }

        db.Roles.AddRange(missing.Select(r => new Role
        {
            Code = r.Code,
            Name = r.Name,
            Description = r.Description,
            IsSystem = true
        }));
        await db.SaveChangesAsync(ct);
    }

    private static async Task SeedRolePermissionsAsync(DubheDbContext db, CancellationToken ct)
    {
        var roles = await db.Roles.ToDictionaryAsync(r => r.Code, ct);
        var permissions = await db.Permissions.ToDictionaryAsync(p => p.Code, ct);
        var existing = await db.RolePermissions
            .Select(rp => new { rp.RoleId, rp.PermissionId })
            .ToListAsync(ct);
        var existingSet = existing.Select(x => (x.RoleId, x.PermissionId)).ToHashSet();

        var added = 0;
        foreach (var (roleCode, permissionCodes) in PermissionCatalog.DefaultRolePermissions)
        {
            if (!roles.TryGetValue(roleCode, out var role))
            {
                continue;
            }

            IEnumerable<string> codes = permissionCodes.Contains("*")
                ? permissions.Keys
                : permissionCodes;
            foreach (var code in codes)
            {
                if (!permissions.TryGetValue(code, out var permission))
                {
                    continue;
                }

                if (existingSet.Contains((role.Id, permission.Id)))
                {
                    continue;
                }

                db.RolePermissions.Add(new RolePermission { RoleId = role.Id, PermissionId = permission.Id });
                added++;
            }
        }

        if (added > 0)
        {
            await db.SaveChangesAsync(ct);
        }
    }

    private static async Task SeedAdminAsync(
        DubheDbContext db,
        IPasswordHasher passwordHasher,
        IConfiguration configuration,
        ILogger logger,
        CancellationToken ct)
    {
        var hasAdmin = await db.Users.AnyAsync(u => u.UserType == UserType.PlatformAdmin, ct);
        if (hasAdmin)
        {
            return;
        }

        var username = configuration["Seed:AdminUsername"] ?? "admin";
        var phone = configuration["Seed:AdminPhone"] ?? "13800000000";
        var password = configuration["Seed:AdminPassword"];
        var generated = false;
        if (string.IsNullOrWhiteSpace(password))
        {
            password = GenerateRandomPassword();
            generated = true;
        }

        var adminRole = await db.Roles.FirstAsync(r => r.Code == RoleCodes.Admin, ct);

        var admin = new User
        {
            Username = username,
            Phone = phone,
            PasswordHash = passwordHasher.Hash(password),
            DisplayName = "平台管理员",
            UserType = UserType.PlatformAdmin,
            Status = AccountStatus.Active
        };

        db.Users.Add(admin);
        db.UserRoles.Add(new UserRole { User = admin, Role = adminRole });
        await db.SaveChangesAsync(ct);

        if (generated)
        {
            logger.LogWarning(
                "已创建默认管理员账号 {Username}（手机号 {Phone}）；初始密码为本次随机生成：{Password}（仅打印这一次，请立即保存并在登录后修改）",
                username, phone, password);
        }
        else
        {
            logger.LogWarning("已创建默认管理员账号 {Username}（手机号 {Phone}），请尽快修改初始密码", username, phone);
        }
    }

    private static string GenerateRandomPassword()
    {
        const string upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        const string lower = "abcdefghijkmnopqrstuvwxyz";
        const string digits = "23456789";
        const string all = upper + lower + digits;

        var chars = new char[16];
        for (var i = 0; i < chars.Length; i++)
        {
            var pool = i switch
            {
                0 => upper,
                1 => lower,
                2 => digits,
                _ => all
            };
            chars[i] = pool[RandomNumberGenerator.GetInt32(pool.Length)];
        }

        return new string(chars);
    }
}
