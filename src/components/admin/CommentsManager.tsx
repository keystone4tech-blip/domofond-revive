import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

interface Comment {
  id: string;
  user_id: string;
  text: string;
  created_at: string;
  content_type: string;
  content_id: string;
  is_approved: boolean;
}

export const CommentsManager = () => {
  const [pendingComments, setPendingComments] = useState<Comment[]>([]);
  const [approvedComments, setApprovedComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchComments();
  }, []);

  const fetchComments = async () => {
    setLoading(true);
    
    const { data: pending, error: pendingError } = await supabase
      .from("comments")
      .select("*")
      .eq("is_approved", false)
      .order("created_at", { ascending: false });

    const { data: approved, error: approvedError } = await supabase
      .from("comments")
      .select("*")
      .eq("is_approved", true)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!pendingError && pending) {
      setPendingComments(pending);
    }
    
    if (!approvedError && approved) {
      setApprovedComments(approved);
    }
    
    setLoading(false);
  };

  const handleApprove = async (commentId: string) => {
    const { error } = await supabase
      .from("comments")
      .update({ is_approved: true })
      .eq("id", commentId);

    if (!error) {
      toast({
        title: "Успешно",
        description: "Комментарий одобрен",
      });
      fetchComments();
    } else {
      toast({
        title: "Ошибка",
        description: "Не удалось одобрить комментарий",
        variant: "destructive",
      });
    }
  };

  const handleReject = async (commentId: string) => {
    const { error } = await supabase
      .from("comments")
      .delete()
      .eq("id", commentId);

    if (!error) {
      toast({
        title: "Успешно",
        description: "Комментарий отклонен и удален",
      });
      fetchComments();
    } else {
      toast({
        title: "Ошибка",
        description: "Не удалось отклонить комментарий",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Комментарии на модерации ({pendingComments.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {pendingComments.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Нет комментариев на модерации
            </p>
          ) : (
            pendingComments.map((comment) => (
              <div key={comment.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      Тип: {comment.content_type === "promotion" ? "Акция" : "Новость"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.created_at), {
                        addSuffix: true,
                        locale: ru,
                      })}
                    </p>
                  </div>
                </div>
                <p className="text-sm">{comment.text}</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleApprove(comment.id)}
                    className="gap-2"
                  >
                    <Check className="h-4 w-4" />
                    Одобрить
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleReject(comment.id)}
                    className="gap-2"
                  >
                    <X className="h-4 w-4" />
                    Отклонить
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Одобренные комментарии (последние 20)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {approvedComments.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Нет одобренных комментариев
            </p>
          ) : (
            approvedComments.map((comment) => (
              <div key={comment.id} className="border rounded-lg p-4 space-y-2 bg-muted/50">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      Тип: {comment.content_type === "promotion" ? "Акция" : "Новость"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.created_at), {
                        addSuffix: true,
                        locale: ru,
                      })}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleReject(comment.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm">{comment.text}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};
