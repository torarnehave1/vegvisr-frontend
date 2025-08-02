-- Add flow_type column to affiliate_invitations table to track different invitation flows

ALTER TABLE affiliate_invitations 
ADD COLUMN flow_type TEXT DEFAULT 'new_user' CHECK (flow_type IN ('new_user', 'existing_user'));
