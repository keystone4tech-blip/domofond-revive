import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, Send, Trash2, LogIn } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Comment {
  id: string;
  user_id: string;
  text: string;
  created_at: string;
}

interface CommentsSectionProps {
  contentType: "promotion" | "news";
  contentId: string;
}

export const CommentsSection = ({ contentType, contentId }: CommentsSectionProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
    fetchComments();
  }, [contentId]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setIsAuthenticated(!!user);
    setCurrentUserId(user?.id || null);
  };

  const fetchComments = async () => {
    const { data, error } = await supabase
      .from("comments")
      .select("id, user_id, text, created_at")
      .eq("content_type", contentType)
      .eq("content_id", contentId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setComments(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAuthenticated) {
      toast({
        title: "Требуется авторизация",
        description: "Войдите в систему, чтобы оставить комментарий",
        variant: "destructive",
      });
      return;
    }

    if (!newComment.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const { error } = await supabase
      .from("comments")
      .insert({
        content_type: contentType,
        content_id: contentId,
        user_id: user.id,
        text: newComment.trim(),
      });

    if (!error) {
      setNewComment("");
      fetchComments();
      toast({
        title: "Комментарий отправлен",
        description: "Ваш комментарий скоро появится после модерации",
      });
    } else {
      toast({
        title: "Ошибка",
        description: "Не удалось добавить комментарий",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (commentId: string) => {
    const { error } = await supabase
      .from("comments")
      .delete()
      .eq("id", commentId);

    if (!error) {
      fetchComments();
      toast({
        title: "Успешно",
        description: "Комментарий удален",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <MessageCircle className="h-5 w-5" />
          <span>{comments.length}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Комментарии ({comments.length})</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {isAuthenticated && (
            <form onSubmit={handleSubmit} className="space-y-2">
              <Textarea
                placeholder="Напишите комментарий..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="min-h-[100px]"
              />
              <Button type="submit" size="sm" className="gap-2">
                <Send className="h-4 w-4" />
                Отправить
              </Button>
            </form>
          )}

          {!isAuthenticated && (
            <div className="p-6 bg-muted rounded-lg text-center space-y-3">
              <p className="text-muted-foreground">
                Войдите в систему, чтобы оставить комментарий
              </p>
              <Button 
                onClick={() => {
                  setIsOpen(false);
                  navigate("/auth");
                }} 
                className="gap-2"
              >
                <LogIn className="h-4 w-4" />
                Войти в систему
              </Button>
            </div>
          )}

          <div className="space-y-3">
            {comments.map((comment) => (
              <div key={comment.id} className="p-4 bg-muted rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold">Пользователь</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.created_at), {
                        addSuffix: true,
                        locale: ru,
                      })}
                    </p>
                  </div>
                  {currentUserId === comment.user_id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(comment.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-sm">{comment.text}</p>
              </div>
            ))}

            {comments.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                Пока нет комментариев
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
