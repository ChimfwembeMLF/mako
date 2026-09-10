import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Bot, Plus, Clock, Save, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useWorkspaceAutomationConfig } from "../../hooks/api/useWorkspaceAutomationConfig";
import { useWorkspace } from "@/hooks/useWorkspace";
import { toast } from "sonner";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PLATFORMS = [
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "twitter", label: "Twitter" },
  { id: "linkedin", label: "LinkedIn" },
];

export function AutomationSettingsTab() {
  const { activeWorkspace } = useWorkspace();
  const { config, isLoading, updateConfig } = useWorkspaceAutomationConfig(activeWorkspace);
  const [isSaving, setIsSaving] = useState(false);

  const [isActive, setIsActive] = useState(false);
  const [timezone, setTimezone] = useState("Africa/Cairo");
  const [generateAt, setGenerateAt] = useState("19:00");
  const [postsPerCycle, setPostsPerCycle] = useState("3");
  const [planAhead, setPlanAhead] = useState("1");
  const [activeDays, setActiveDays] = useState<string[]>([]);
  const [postingTimes, setPostingTimes] = useState<string[]>([]);
  const [activePlatforms, setActivePlatforms] = useState<string[]>([]);

  useEffect(() => {
    if (config) {
      setIsActive(config.isActive ?? false);
      setTimezone(config.timezone ?? "America/New_York");
      setGenerateAt(config.generateAt ?? "19:00");
      setPostsPerCycle(String(config.postsPerCycle ?? 3));
      setPlanAhead(String(config.planAheadDays ?? 1));
      setActiveDays(config.publishingDays ?? []);
      setPostingTimes(config.postingTimes ?? []);
      setActivePlatforms(config.platforms ?? []);
    }
  }, [config]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateConfig({
        isActive,
        timezone,
        generateAt,
        postsPerCycle: parseInt(postsPerCycle, 10),
        planAheadDays: parseInt(planAhead, 10),
        publishingDays: activeDays,
        postingTimes,
        platforms: activePlatforms,
      });
      toast.success("Automation settings saved successfully.");
    } catch (error) {
      toast.error("Failed to save automation settings.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const toggleDay = (day: string) => {
    setActiveDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const togglePlatform = (platformId: string) => {
    setActivePlatforms(prev => 
      prev.includes(platformId) ? prev.filter(p => p !== platformId) : [...prev, platformId]
    );
  };

  const handleAddPostingTime = () => {
    setPostingTimes([...postingTimes, "12:00"].sort());
  };

  const handleRemovePostingTime = (index: number) => {
    setPostingTimes(postingTimes.filter((_, i) => i !== index));
  };

  const handlePostingTimeChange = (index: number, newTime: string) => {
    const updated = [...postingTimes];
    updated[index] = newTime;
    setPostingTimes(updated.sort());
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          Automation
        </h2>
        <p className="text-muted-foreground mt-1">
          Generate, review, schedule, and publish content on a durable background schedule.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-card">
            <CardHeader className="pb-4 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded bg-muted flex items-center justify-center border border-border/50">
                    <Bot className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Automation</CardTitle>
                    <CardDescription className="text-xs">
                      {postsPerCycle} posts at {postingTimes.join(", ")} &middot; generated {generateAt} ({timezone})
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{isActive ? "Active" : "Paused"}</span>
                  <Switch
                    checked={isActive}
                    onCheckedChange={setIsActive}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-8">
              {/* Generation schedule */}
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Generation schedule
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Automation prepares content before the reserved publishing slots.
                  </p>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Timezone</label>
                    <Select value={timezone} onValueChange={setTimezone}>
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Africa/Cairo">Africa/Cairo</SelectItem>
                        <SelectItem value="America/New_York">America/New_York</SelectItem>
                        <SelectItem value="Europe/London">Europe/London</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Generate at</label>
                    <div className="relative">
                      <Input 
                        type="time" 
                        value={generateAt} 
                        onChange={(e) => setGenerateAt(e.target.value)}
                        className="bg-background"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Posts per cycle</label>
                    <Input 
                      type="number" 
                      min="1"
                      value={postsPerCycle} 
                      onChange={(e) => setPostsPerCycle(e.target.value)}
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Plan ahead</label>
                    <Select value={planAhead} onValueChange={setPlanAhead}>
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1 day">1 day</SelectItem>
                        <SelectItem value="3 days">3 days</SelectItem>
                        <SelectItem value="1 week">1 week</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Publishing schedule */}
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4"><path d="M4.5 1V3M10.5 1V3M2.5 4.5H12.5M2 2.5H13C13.2761 2.5 13.5 2.72386 13.5 3V13C13.5 13.2761 13.2761 13.5 13 13.5H2C1.72386 13.5 1.5 13.2761 1.5 13V3C1.5 2.72386 1.72386 2.5 2 2.5Z" stroke="currentColor" strokeWidth="1.2"></path><path d="M5.5 8C5.5 7.72386 5.72386 7.5 6 7.5H9C9.27614 7.5 9.5 7.72386 9.5 8C9.5 8.27614 9.27614 8.5 9 8.5H6C5.72386 8.5 5.5 8.27614 5.5 8Z" fill="currentColor"></path><path d="M5.5 10.5C5.5 10.2239 5.72386 10 6 10H8C8.27614 10 8.5 10.2239 8.5 10.5C8.5 10.7761 8.27614 11 8 11H6C5.72386 11 5.5 10.7761 5.5 10.5Z" fill="currentColor"></path></svg>
                    Publishing schedule
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pending posts reserve these calendar times; approval confirms them.
                  </p>
                </div>
                
                <div className="space-y-3">
                  <label className="text-xs font-semibold">Publishing days</label>
                  <div className="flex bg-muted/40 p-1 rounded-md border border-border/50">
                    {DAYS.map(day => (
                      <button
                        key={day}
                        onClick={() => toggleDay(day)}
                        className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
                          activeDays.includes(day) 
                            ? 'bg-background shadow-sm text-foreground' 
                            : 'text-muted-foreground hover:bg-muted/60'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold">Posting times</label>
                    <Button variant="ghost" size="sm" onClick={handleAddPostingTime} className="h-6 text-xs px-2 hover:bg-muted/50">
                      <Plus className="h-3 w-3 mr-1" /> Add time
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {postingTimes.map((time, index) => (
                      <div key={index} className="flex items-center gap-2 bg-muted/20 p-1.5 rounded-md border border-border/50">
                        <div className="relative flex-1">
                          <Input 
                            type="time" 
                            value={time} 
                            onChange={(e) => handlePostingTimeChange(index, e.target.value)}
                            className="bg-background h-8 text-sm"
                          />
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleRemovePostingTime(index)}
                          disabled={postingTimes.length <= 1}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Content rotation */}
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4"><path d="M10.5 7.5L8.5 9.5M10.5 7.5L8.5 5.5M10.5 7.5H4C3.17157 7.5 2.5 8.17157 2.5 9V11.5M4.5 7.5L6.5 5.5M4.5 7.5L6.5 9.5M4.5 7.5H11C11.8284 7.5 12.5 6.82843 12.5 6V3.5" stroke="currentColor" strokeWidth="1.2"></path></svg>
                    Content rotation
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Posts rotate across platforms and categories to avoid repetitive output.
                  </p>
                </div>
                
                <div className="space-y-3">
                  <label className="text-xs font-semibold">Platforms</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {PLATFORMS.map(platform => (
                      <div key={platform.id} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`platform-${platform.id}`} 
                          checked={activePlatforms.includes(platform.id)}
                          onCheckedChange={() => togglePlatform(platform.id)}
                        />
                        <label 
                          htmlFor={`platform-${platform.id}`} 
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {platform.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="pt-4 border-t border-border/50 flex justify-end">
                 <Button onClick={handleSave} disabled={isSaving}>
                   {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} 
                   Save settings
                 </Button>
              </div>

            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-card">
            <CardHeader className="pb-4 border-b border-border/50 bg-muted/10">
              <CardTitle className="text-lg">Recent cycles</CardTitle>
              <CardDescription>
                Background generation, notification, and approval status.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-10 pb-12 flex flex-col items-center justify-center text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Clock className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-sm mb-1">No cycles yet</h3>
              <p className="text-xs text-muted-foreground max-w-[200px]">
                Save the schedule or generate now.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
