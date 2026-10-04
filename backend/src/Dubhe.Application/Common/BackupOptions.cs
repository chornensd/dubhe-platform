namespace Dubhe.Application.Common;

public sealed class BackupOptions
{
    public const string SectionName = "Backups";

    public string Directory { get; set; } = "backups";
}
